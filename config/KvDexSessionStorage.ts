import { SessionStorage } from "@innovatedev/fresh-session";
import type {
  Collection,
  CollectionOptions,
  KvValue,
  ParseId,
} from "@olli/kvdex";

/**
 * Session storage implementation using kvdex Collection.
 * This storage uses a kvdex Collection to persist sessions.
 */
export interface KvDexSessionStorageOptions<
  TSessionInput extends KvValue,
  TSessionOutput extends TSessionInput,
  TSessionOptions extends CollectionOptions<TSessionOutput>,
  TUserInput extends KvValue,
  TUserOutput extends TUserInput,
  TUserOptions extends CollectionOptions<TUserOutput>,
> {
  collection: Collection<TSessionInput, TSessionOutput, TSessionOptions>;
  userCollection: Collection<TUserInput, TUserOutput, TUserOptions>;
  /**
   * Session expiration in seconds.
   */
  expireAfter?: number;
}

export class KvDexSessionStorage<
  const TSessionInput extends KvValue,
  const TSessionOutput extends TSessionInput,
  const TSessionOptions extends CollectionOptions<TSessionOutput>,
  const TUserInput extends KvValue,
  const TUserOutput extends TUserInput,
  const TUserOptions extends CollectionOptions<TUserOutput>,
> implements SessionStorage {
  #collection: Collection<TSessionInput, TSessionOutput, TSessionOptions>;
  #userCollection: Collection<TUserInput, TUserOutput, TUserOptions>;
  #expireAfter?: number;

  constructor(
    options: KvDexSessionStorageOptions<
      TSessionInput,
      TSessionOutput,
      TSessionOptions,
      TUserInput,
      TUserOutput,
      TUserOptions
    >,
  ) {
    this.#collection = options.collection;
    this.#userCollection = options.userCollection;
    this.#expireAfter = options.expireAfter;
  }

  async get(sessionId: string) {
    // We cast sessionId to ParseId<TSessionOptions> because SessionStorage enforces string IDs,
    // and we assume the underlying collection supports string-compatible IDs.
    const doc = await this.#collection.find(
      sessionId as unknown as ParseId<TSessionOptions>,
    );
    // Unwrap the session data from the document structure
    return (doc?.value as any)?.data ?? null;
  }

  async set(sessionId: string, payload: TSessionInput) {
    // Check if session exists to preserve createdAt
    const existing = await this.#collection.find(
      sessionId as unknown as ParseId<TSessionOptions>,
    );

    const now = new Date();
    const createdAt = (existing?.value as any)?.createdAt ?? now;
    const expiresAt = this.#expireAfter
      ? new Date(now.getTime() + this.#expireAfter * 1000)
      : new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365); // Default to 1 year if not set, or handle null

    // Construct the full document matching SessionModel
    const doc = {
      id: sessionId,
      createdAt,
      updatedAt: now,
      expiresAt,
      data: payload,
      // userId? We leave it optional/undefined for now as extraction logic is unclear
    };

    // Use set with overwrite (upsert behavior)
    // We explicitly cast to any to bypass complex kvdex typing because we are constructing a specifically shaped object
    // that might strictly differ from generic TSessionInput but matches the actual strict schema.
    await this.#collection.set(
      sessionId as unknown as ParseId<TSessionOptions>,
      doc as any,
      {
        expireIn: this.#expireAfter ? this.#expireAfter * 1000 : undefined,
      } as any,
    );
  }

  async resolveUser(userId: string) {
    const doc = await this.#userCollection.find(
      userId as unknown as ParseId<TUserOptions>,
    );
    return doc?.flat ?? null;
  }

  async delete(sessionId: string) {
    await this.#collection.delete(
      sessionId as unknown as ParseId<TSessionOptions>,
    );
  }
}
