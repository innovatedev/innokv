import { db } from "@/kv/db.ts";
import { hash, verify } from "@felix/argon2";
import { type User, type UserValue } from "@/kv/models.ts";
export type { User, UserValue };

export async function findUserByEmail(email: string) {
  return await db.users.findByPrimaryIndex("email", email);
}

export interface CreateUserOptions {
  username?: string;
  email: string;
  password: string;
  permissions?: string[];
}

export async function createUser(
  { username, email, password, permissions = [] }: CreateUserOptions,
): Promise<{ ok: boolean; user?: User; error?: string }> {
  const existing = await findUserByEmail(email);
  if (existing) {
    return { ok: false, error: "User already exists" };
  }

  // Hash the password
  const passwordHash = await hash(password);

  // Ensure uniqueness
  const permissionsSet = Array.from(new Set(permissions));

  // Generate ID explicitly so we can return it and use it as key
  const id = crypto.randomUUID();

  // Save user to DB (without ID in body)
  const user: UserValue = {
    username,
    email,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    permissions: permissionsSet,
  };

  const commit = await db.users.set(id, user);

  if (commit.ok) {
    return { ok: true, user: { ...user, id } };
  } else {
    return { ok: false, error: "Failed to create user in database" };
  }
}

export async function getAllUsers(): Promise<User[]> {
  const { result } = await db.users.getMany();
  // deno-lint-ignore no-explicit-any
  return (result as any[]).map((doc) => ({ ...doc.value, id: doc.id }) as User);
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
): Promise<{ ok: boolean; user?: User; error?: string; id?: string }> {
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
  const updates: Partial<typeof userData> = {
    lastLoginAt: new Date(),
  };

  // Ensure uniqueness
  permissions = Array.from(new Set(permissions));

  // Check if different from original
  if (
    permissions.length !== userData.permissions.length ||
    !permissions.every((p: string) => userData.permissions.includes(p))
  ) {
    updates.permissions = permissions;
  }

  // Always update lastLoginAt and save
  await db.users.update(userDoc.id, updates);

  return { ok: true, user: { ...userData, id: userDoc.id }, id: userDoc.id };
}

export async function changePassword(
  userId: string,
  newPassword: string,
): Promise<boolean> {
  const userDoc = await db.users.find(userId);
  if (!userDoc) return false;

  const passwordHash = await hash(newPassword);

  const result = await db.users.update(userId, {
    passwordHash,
    updatedAt: new Date(),
  });

  return result.ok;
}

export async function updateUserSettings(
  userId: string,
  settings: User["settings"],
): Promise<boolean> {
  const userDoc = await db.users.find(userId);
  if (!userDoc) return false;

  const currentSettings = userDoc.value.settings || {};
  const newSettings = { ...currentSettings, ...settings };

  const result = await db.users.update(userId, {
    settings: newSettings,
    updatedAt: new Date(),
  });

  return result.ok;
}
