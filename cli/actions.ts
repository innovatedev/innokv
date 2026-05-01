import { KeyCodec, ValueCodec } from "@/codec/mod.ts";
import { readConfig } from "./config.ts";
import { db } from "@/kv/db.ts";
import { DatabaseRepository } from "../lib/Database.ts";
import { hasPermission, rulesToPermissions } from "../lib/permissions.ts";
import {
  changePassword,
  createUser,
  type CreateUserOptions,
  findUserByEmail,
} from "../lib/users.ts";

import { KvExplorer } from "../lib/KvExplorer.ts";
import { ApiKvKeyPart } from "../lib/types.ts";

export interface UpdateOptions {
  mergeArrays?: boolean;
}
/**
 * Ensures the CLI user is authenticated and returns the user and token.
 */
export async function ensureAuthenticated() {
  const config = await readConfig();
  if (!config.token) {
    throw new Error(
      "Authentication required. Please run 'innokv login' to authenticate.",
    );
  }
  // Hash the token for lookup
  const encoder = new TextEncoder();
  const data = encoder.encode(config.token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const tokenDoc = await db.apiTokens.findByPrimaryIndex(
    "tokenHash",
    tokenHash,
  );
  if (!tokenDoc) {
    throw new Error(
      "Invalid or expired session. Please run 'innokv login' again.",
    );
  }
  // Check expiration
  if (tokenDoc.value.expiresAt && tokenDoc.value.expiresAt < new Date()) {
    throw new Error(
      "Session expired. Please run 'innokv login' again.",
    );
  }
  const userDoc = await db.users.find(tokenDoc.value.userId);
  if (!userDoc) {
    throw new Error("User associated with this token not found.");
  }
  return {
    user: { ...userDoc.value, id: userDoc.id },
    token: { ...tokenDoc.value, id: tokenDoc.id },
  };
}
/**
 * Checks if the current session has permission for an action on a database.
 */
async function checkPermission(
  slug: string,
  action: "read" | "write" | "manage",
) {
  const { user, token } = await ensureAuthenticated();
  let permissions: string[] = [];
  if (token.type === "personal") {
    permissions = user.permissions;
  } else {
    permissions = rulesToPermissions(token.rules);
  }
  const requiredPerm = `database:${action}:${slug}`;
  if (!hasPermission(permissions, requiredPerm)) {
    throw new Error(
      `Permission denied: You do not have '${action}' access to database '${slug}'.`,
    );
  }
}
/**
 * Checks if the user can manage other users.
 * Allows access if no users exist (Bootstrap Mode).
 */
export async function checkUserManagePermission() {
  const userCount = await db.users.count();
  if (userCount === 0) return; // Bootstrap mode
  const { user, token } = await ensureAuthenticated();
  let permissions: string[] = [];
  if (token.type === "personal") {
    permissions = user.permissions;
  } else {
    permissions = rulesToPermissions(token.rules);
  }
  if (!hasPermission(permissions, "users:manage")) {
    throw new Error(
      "Permission denied: You do not have 'users:manage' access.",
    );
  }
}
// --- Database Actions ---
export async function doLs(kv: Deno.Kv, slug: string, targetPath: unknown[]) {
  await checkPermission(slug, "read");
  const seenKeys = new Set<string>();
  const keys: string[] = [];
  const iter = kv.list({ prefix: targetPath as Deno.KvKey });
  for await (const entry of iter) {
    const remainingKey = entry.key.slice(targetPath.length);
    if (remainingKey.length > 0) {
      const nextPart = remainingKey[0];
      const displayKey = formatKeyPart(nextPart);
      if (!seenKeys.has(displayKey)) {
        keys.push(displayKey);
        seenKeys.add(displayKey);
      }
    }
  }
  return keys;
}
function formatKeyPart(part: Deno.KvKeyPart): string {
  if (typeof part === "string") return JSON.stringify(part);
  if (typeof part === "number" || typeof part === "boolean") {
    return String(part);
  }
  if (typeof part === "bigint") return `${part}n`;
  if (part instanceof Uint8Array) return `u8[${Array.from(part).join(",")}]`;
  return String(part);
}
export async function doGet(kv: Deno.Kv, slug: string, targetPath: unknown[]) {
  await checkPermission(slug, "read");
  const res = await kv.get(targetPath as Deno.KvKey);
  return res;
}
export async function doSet(
  kv: Deno.Kv,
  slug: string,
  targetPath: unknown[],
  value: string,
  options: { rich?: boolean } = {},
) {
  await checkPermission(slug, "write");
  let parsedValue: unknown;
  if (options.rich) {
    const rich = JSON.parse(value);
    parsedValue = ValueCodec.decodeForKv(rich);
  } else {
    try {
      if (value.endsWith("n") && !isNaN(Number(value.slice(0, -1)))) {
        parsedValue = BigInt(value.slice(0, -1));
      } else {
        parsedValue = JSON.parse(value);
      }
    } catch {
      parsedValue = value;
    }
  }
  await kv.set(targetPath as Deno.KvKey, parsedValue);
}
export async function doUpdate(
  kv: Deno.Kv,
  slug: string,
  targetPath: unknown[],
  value: string,
  options: UpdateOptions & { rich?: boolean } = {},
) {
  await checkPermission(slug, "write");
  let newValue: unknown;
  if (options.rich) {
    const rich = JSON.parse(value);
    newValue = ValueCodec.decodeForKv(rich);
  } else {
    try {
      if (value.endsWith("n") && !isNaN(Number(value.slice(0, -1)))) {
        newValue = BigInt(value.slice(0, -1));
      } else {
        newValue = JSON.parse(value);
      }
    } catch {
      newValue = value;
    }
  }
  const res = await kv.get(targetPath as Deno.KvKey);
  const existingValue = res.value;
  let mergedValue = newValue;
  if (
    existingValue !== null && typeof existingValue === "object" &&
    newValue !== null && typeof newValue === "object"
  ) {
    const isPlainObject = (obj: unknown) =>
      obj?.constructor === Object || Object.getPrototypeOf(obj) === null;

    if (Array.isArray(existingValue) && Array.isArray(newValue)) {
      if (options.mergeArrays) {
        mergedValue = Array.from(new Set([...existingValue, ...newValue]));
      } else {
        mergedValue = newValue;
      }
    } else if (isPlainObject(existingValue) && isPlainObject(newValue)) {
      mergedValue = { ...existingValue, ...(newValue as object) };
    }
  }
  const commit = await kv.atomic()
    .check(res)
    .set(targetPath as Deno.KvKey, mergedValue)
    .commit();
  if (!commit.ok) {
    throw new Error("Failed to update: versionstamp check failed or conflict.");
  }
}
// --- User Management Actions ---
export async function doUserAdd(options: CreateUserOptions) {
  await checkUserManagePermission();
  return await createUser(options);
}
import { type User } from "@/kv/models.ts";

export async function doUserLs() {
  await checkUserManagePermission();
  const { result: users } = await db.users.getMany();
  // deno-lint-ignore no-explicit-any
  return (users as any[])
    .map((doc) => ({ ...doc.value, id: doc.id }) as User)
    .sort((a, b) =>
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
}
export async function doUserResetPassword(email: string, password: string) {
  await checkUserManagePermission();
  const userDoc = await findUserByEmail(email);
  if (!userDoc) throw new Error(`User with email '${email}' not found.`);
  return await changePassword(userDoc.id, password);
}
export async function doMv(
  _kv: Deno.Kv,
  slug: string,
  oldPath: unknown[],
  newPathStr: string,
  recursive = false,
) {
  let targetId = slug;
  let targetPathRaw = newPathStr;
  if (newPathStr.includes(":")) {
    const parts = newPathStr.split(":");
    targetId = parts[0];
    targetPathRaw = parts.slice(1).join(":");
  }
  const repo = new DatabaseRepository(db);
  const oldPathStr = KeyCodec.encode(oldPath as ApiKvKeyPart[]);
  return await repo.moveRecords(slug, {
    oldPath: oldPathStr,
    newPath: targetPathRaw,
    recursive,
    targetId,
  });
}
export async function doCp(
  _kv: Deno.Kv,
  slug: string,
  oldPath: unknown[],
  newPathStr: string,
  recursive = false,
) {
  let targetId = slug;
  let targetPathRaw = newPathStr;
  if (newPathStr.includes(":")) {
    const parts = newPathStr.split(":");
    targetId = parts[0];
    targetPathRaw = parts.slice(1).join(":");
  }
  const repo = new DatabaseRepository(db);
  const oldPathStr = KeyCodec.encode(oldPath as ApiKvKeyPart[]);
  return await repo.copyRecords(slug, {
    oldPath: oldPathStr,
    newPath: targetPathRaw,
    recursive,
    targetId,
  });
}
export async function doExport(
  kv: Deno.Kv,
  slug: string,
  path: unknown[],
  recursive = true,
) {
  await checkPermission(slug, "read");
  const explorer = new KvExplorer(kv);
  return await explorer.exportToJson(path as Deno.KvKey, recursive);
}
export async function doImport(
  kv: Deno.Kv,
  slug: string,
  // deno-lint-ignore no-explicit-any
  entries: any[],
) {
  await checkPermission(slug, "write");
  const explorer = new KvExplorer(kv);
  const result = await explorer.importFromJson(entries);
  console.log(`Successfully imported ${result.importedCount} records.`);
  return result;
}
export async function doTree(
  kv: Deno.Kv,
  slug: string,
  targetPath: unknown[],
) {
  await checkPermission(slug, "read");
  const prefix = targetPath as Deno.KvKey;
  const iter = kv.list({ prefix });
  interface TreeNode {
    children: Map<string, TreeNode>;
    isValue: boolean;
    type?: string;
  }
  const root: TreeNode = { children: new Map(), isValue: false };
  for await (const entry of iter) {
    const relativeKey = entry.key.slice(prefix.length);
    let current = root;
    for (let i = 0; i < relativeKey.length; i++) {
      const part = relativeKey[i];
      const keyStr = formatKeyPart(part);
      if (!current.children.has(keyStr)) {
        current.children.set(keyStr, { children: new Map(), isValue: false });
      }
      current = current.children.get(keyStr)!;
      if (i === relativeKey.length - 1) {
        current.isValue = true;
        // Determine type
        if (entry.value === null) current.type = "null";
        else if (entry.value instanceof Uint8Array) current.type = "Uint8Array";
        else if (entry.value instanceof Date) current.type = "Date";
        else if (Array.isArray(entry.value)) current.type = "Array";
        else current.type = typeof entry.value;
      }
    }
  }
  function print(node: TreeNode, indent = "", isLast = true, label = "") {
    if (label !== "") {
      const connector = isLast ? "└── " : "├── ";
      const typeInfo = node.isValue ? ` \x1b[90m(${node.type})\x1b[0m` : "";
      console.log(`${indent}${connector}${label}${typeInfo}`);
    }
    const childIndent = indent +
      (label === "" ? "" : (isLast ? "    " : "│   "));
    const entries = Array.from(node.children.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (let i = 0; i < entries.length; i++) {
      const [name, child] = entries[i];
      print(child, childIndent, i === entries.length - 1, name);
    }
  }
  const header = `\x1b[1m${slug}\x1b[0m` +
    (prefix.length > 0 ? ` \x1b[90m[${prefix.join("/")}]\x1b[0m` : "");
  console.log(header);
  print(root);
}
export async function doStats(
  slug: string,
  pathInfo?: string,
  timeoutMs?: number,
) {
  await checkPermission(slug, "manage");
  const { user } = await ensureAuthenticated();
  const repo = new DatabaseRepository(db);
  return await repo.getDatabaseStats(slug, pathInfo, user.id, timeoutMs);
}
