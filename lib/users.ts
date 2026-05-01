// deno-lint-ignore-file no-explicit-any
import { db } from "@/kv/db.ts";
import { hash, verify } from "@felix/argon2";
import { type User, type UserValue } from "@/kv/models.ts";
export type { User, UserValue };

/**
 * Finds a user by their email address.
 *
 * @param email - User's email address.
 * @returns User document or null if not found.
 */
export async function findUserByEmail(email: string) {
  return await db.users.findByPrimaryIndex("email", email);
}

export interface CreateUserOptions {
  username?: string;
  email: string;
  password: string;
  permissions?: string[];
}

/**
 * Creates a new user record.
 *
 * @param options - User creation details.
 * @returns Object indicating success or failure with error details.
 */
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
    return { ok: true, user: { ...user, id } as User };
  } else {
    return { ok: false, error: "Failed to create user in database" };
  }
}

/**
 * Retrieves all registered users.
 *
 * @returns Array of user objects.
 */
export async function getAllUsers(): Promise<User[]> {
  const { result } = await db.users.getMany();
  return result.map((doc: any) => ({ ...doc.value, id: doc.id }) as User);
}

/**
 * Updates the permissions for a specific user.
 *
 * @param id - User ID.
 * @param newPermissions - Array of permission strings.
 * @returns True if the update was successful.
 */
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

/**
 * Deletes a user record.
 *
 * @param id - User ID.
 * @returns True if deletion was initiated.
 */
export async function deleteUser(id: string): Promise<boolean> {
  await db.users.delete(id);
  return true;
}

/**
 * Authenticates a user by email and password.
 * Updates the lastLoginAt timestamp on success.
 *
 * @param email - User email.
 * @param password - Plain-text password.
 * @returns Authentication result including user object and ID.
 */
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
  const user = { ...userData, id: userDoc.id } as User;

  return { ok: true, user, id: userDoc.id };
}

/**
 * Changes a user's password.
 *
 * @param userId - User ID.
 * @param newPassword - New plain-text password.
 * @returns True if the password was updated.
 */
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

/**
 * Updates application settings for a specific user.
 *
 * @param userId - User ID.
 * @param settings - Partial settings object.
 * @returns True if settings were updated.
 */
export async function updateUserSettings(
  userId: string,
  settings: User["settings"],
): Promise<boolean> {
  const userDoc = await db.users.find(userId);
  if (!userDoc) return false;

  const currentSettings = userDoc.value.settings || {};
  const newSettings = { ...currentSettings, ...(settings || {}) };

  const result = await db.users.update(userId, {
    settings: newSettings,
    updatedAt: new Date(),
  });

  return result.ok;
}
