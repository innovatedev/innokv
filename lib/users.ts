import { db } from "@/lib/db.ts";
import { hash, verify } from "@felix/argon2";
import settings from "@/config/app.ts";
import { type User } from "@/lib/models.ts";

export type UserWithId = User & { id: string };

export async function findUserByEmail(email: string) {
  return await db.users.findByPrimaryIndex("email", email);
}

export async function createUser(
  { email, password, permissions = [] }: {
    email: string;
    password: string;
    permissions?: string[];
  },
): Promise<{ ok: boolean; user?: UserWithId; error?: string }> {
  const existing = await findUserByEmail(email);
  if (existing) {
    return { ok: false, error: "User already exists" };
  }

  // Hash the password
  const passwordHash = await hash(password);

  // Check if email is in admin list
  let finalPermissions = [...permissions];
  if (settings.admin.emails.includes(email)) {
    if (!finalPermissions.includes("*")) {
      finalPermissions.push("*");
    }
  }
  // Ensure uniqueness
  finalPermissions = Array.from(new Set(finalPermissions));

  // Generate ID explicitly so we can return it and use it as key
  const id = crypto.randomUUID();

  // Save user to DB (without ID in body)
  const user: User = {
    email,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    permissions: finalPermissions,
  };

  const commit = await db.users.set(id, user);

  if (commit.ok) {
    return { ok: true, user: { ...user, id } };
  } else {
    return { ok: false, error: "Failed to create user in database" };
  }
}

export async function getAllUsers(): Promise<UserWithId[]> {
  const { result } = await db.users.getMany();
  return result.map((doc) => ({ ...doc.value, id: doc.id }));
}

export async function updateUserPermissions(
  id: string,
  newPermissions: string[],
): Promise<boolean> {
  const userDoc = await db.users.find(id);
  if (!userDoc) return false;

  // Deduplicate
  const permissions = Array.from(new Set(newPermissions));

  // Use set (overwrite) to ensure array is replaced, not merged
  const updatedUser = {
    ...userDoc.value,
    permissions,
    updatedAt: new Date(),
  };

  await db.users.delete(id);
  // Delete returns void, assuming success if no throw

  const result = await db.users.set(id, updatedUser);
  return result.ok;
}

export async function deleteUser(id: string): Promise<boolean> {
  await db.users.delete(id);
  return true;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: UserWithId; error?: string; id?: string }> {
  // 1. Fetch user from DB
  const userDoc = await findUserByEmail(email);

  if (!userDoc) {
    return { ok: false, error: "Invalid email or password" };
  }

  // 2. Verify password
  const isValid = await verify(userDoc.value.passwordHash, password);
  if (!isValid) {
    return { ok: false, error: "Invalid email or password" };
  }

  // 3. Admin Permission Check & Update
  const userData = userDoc.value;
  let permissions = userData.permissions;
  let shouldUpdate = false;
  const updates: Partial<typeof userData> = {
    lastLoginAt: new Date(),
  };

  if (settings.admin.emails.includes(email)) {
    // If user is in admin emails list, ensure they have wildcard permission
    if (!permissions.includes("*")) {
      permissions = [...permissions, "*"];
    }
  }

  // Ensure uniqueness
  permissions = Array.from(new Set(permissions));

  // Check if different from original
  if (
    permissions.length !== userData.permissions.length ||
    !permissions.every((p) => userData.permissions.includes(p))
  ) {
    updates.permissions = permissions;
    shouldUpdate = true;
  }

  // Save updates if needed
  if (shouldUpdate) {
    await db.users.update(userDoc.id, updates);
  }

  return { ok: true, user: { ...userData, id: userDoc.id }, id: userDoc.id };
}
