import { db } from "@/kv/db.ts";
import { type ApiToken, type ApiTokenValue } from "@/kv/models.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

/**
 * Creates a new API token for a user.
 * Returns the plain text token secret (only once!) and the created token object.
 */
export async function createToken(
  userId: string,
  data: {
    name: string;
    type: ApiToken["type"];
    rules: ApiToken["rules"];
    expiresAt?: Date;
  },
): Promise<
  { ok: boolean; secret?: string; token?: ApiToken; error?: string }
> {
  // Generate a random 32-byte secret
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const secret = `ikv_${encodeBase64(randomBytes)}`;

  // Hash the secret for storage (SHA-256 for deterministic lookup)
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const token: ApiTokenValue = {
    userId,
    name: data.name,
    tokenHash,
    type: data.type,
    rules: data.rules,
    expiresAt: data.expiresAt,
    createdAt: new Date(),
  };

  const commit = await db.apiTokens.add(token, {
    expireIn: data.expiresAt
      ? data.expiresAt.getTime() - Date.now()
      : undefined,
  });

  if (commit.ok) {
    return { ok: true, secret, token: { ...token, id: commit.id } };
  } else {
    return { ok: false, error: "Failed to create token" };
  }
}

/**
 * Lists all API tokens for a specific user.
 */
export async function listTokens(userId: string): Promise<ApiToken[]> {
  const { result } = await db.apiTokens.getMany({
    // deno-lint-ignore no-explicit-any
    filter: (doc: any) => doc.value.userId === userId,
  });

  // Sort by createdAt desc
  // deno-lint-ignore no-explicit-any
  return (result as any[])
    .map((doc) => ({ ...doc.value, id: doc.id }) as ApiToken)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Revokes (deletes) an API token.
 */
export async function revokeToken(
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const token = await db.apiTokens.find(tokenId);
  if (!token) return false;

  // Ensure user owns the token
  if (token.value.userId !== userId) return false;

  await db.apiTokens.delete(tokenId);
  return true;
}
