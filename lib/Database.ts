// deno-lint-ignore-file no-explicit-any
import {
  KeyCodec,
  KeySerialization,
  RichValue,
  ValueCodec,
} from "@/codec/mod.ts";
import {
  AuditLogValue,
  Database,
  DatabaseModel,
  DatabaseValue,
} from "@/kv/models.ts";
import { ApiKvKeyPart } from "./types.ts";
import { KvExplorer } from "./KvExplorer.ts";

import { BaseRepository, DatabaseError } from "./BaseRepository.ts";
import { ROOT_DB_ID } from "@/kv/db.ts";
export { DatabaseError };

/**
 * Repository for managing multiple Deno KV databases.
 * Handles connections, statistics calculation, and audit logging.
 */
export class DatabaseRepository extends BaseRepository {
  protected explorer: KvExplorer;
  constructor(kvdex: any) {
    super(kvdex);
    this.explorer = new KvExplorer(kvdex.kv);
  }
  async addDatabase(data: Database) {
    const existingDatabase = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      data.slug,
    );
    if (existingDatabase) {
      throw new DatabaseError(
        `Database with slug "${data.slug}" already exists`,
      );
    }
    // Set default timestamps if missing
    if (!data.createdAt) data.createdAt = new Date();
    if (!data.updatedAt) data.updatedAt = new Date();
    let record: DatabaseValue;
    try {
      record = DatabaseModel.assert(data);
    } catch (error) {
      console.error(
        "ERROR: Failed to validate database:",
        error,
      );
      throw new DatabaseError(
        `Invalid database data: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const database = await this.kvdex.databases.add(record);
    if (!database.ok) {
      console.error("ERROR: Failed to create database:", record);
      throw new DatabaseError(
        `Failed to create database: Unknown error`,
      );
    }
    return {
      ...database,
      ...record,
    };
  }
  async updateDatabase(id: string, data: Partial<Database>) {
    // For partial updates, we might bypass strict model validation
    // or validate only provided fields. Since ArkType doesn't have partial(),
    // we'll merge with existing data before validation.
    const existing = await this.kvdex.databases.find(id);
    if (!existing) {
      throw new DatabaseError(`Database with id "${id}" not found`);
    }
    const mergedData = { ...existing.flat(), ...data, updatedAt: new Date() };

    let record: DatabaseValue;
    try {
      record = DatabaseModel.assert(mergedData);
    } catch (error) {
      console.error(
        "ERROR: Failed to validate database update:",
        error,
      );
      throw new DatabaseError(
        `Invalid database data: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const database = await this.kvdex.databases.update(id, record);
    if (!database.ok) {
      console.error("ERROR: Failed to update database:", record, database);
      throw new DatabaseError(
        `Failed to update database: Unknown error`,
      );
    }
    return {
      ...database,
      ...record,
    };
  }
  async deleteDatabase(id: string) {
    if (id === ROOT_DB_ID) {
      throw new DatabaseError("Cannot delete root database");
    }
    const dbDoc = await this.kvdex.databases.find(id);
    if (!dbDoc) {
      throw new DatabaseError(`Database with id "${id}" not found`);
    }
    await this.kvdex.databases.delete(id);
    return { ok: true, name: dbDoc.flat().name };
  }
  async getDatabases(options?: Deno.KvListOptions) {
    return await this.kvdex.databases.getMany(options);
  }
  async getDatabase(id: string) {
    return await this.kvdex.databases.find(id);
  }
  async connectDatabase(database: Database): Promise<Deno.Kv> {
    if (database.type === "file") {
      try {
        const kv = await Deno.openKv(database.path);
        if (database.lastError) {
          // Clear error on success
          this.kvdex.databases.update(database.id, {
            lastError: "",
            lastErrorAt: new Date(0),
          }).catch(() => {});
        }
        return kv;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // Track error
        try {
          await this.kvdex.databases.update(database.id, {
            lastError: message,
            lastErrorAt: new Date(),
          });
        } catch (_) { /* ignore write failure */ }
        throw new DatabaseError(message);
      }
    } else if (database.type === "memory") {
      // Use cached instance if available, otherwise create new and cache it
      let kv = DatabaseRepository.memoryInstances.get(database.id);
      if (!kv) {
        kv = await Deno.openKv(":memory:");
        DatabaseRepository.memoryInstances.set(database.id, kv);
      }
      return kv;
    } else if (database.type === "remote") {
      if (!database.path) {
        throw new DatabaseError(
          `Database with id "${database.id}" does not have a path (UUID)`,
        );
      }
      // Use cached instance if available, otherwise create new and cache it
      let kv = DatabaseRepository.memoryInstances.get(database.id);
      if (!kv) {
        // Handle Token Swap if accessToken is provided
        const tempToken = database.accessToken;
        const originalToken = Deno.env.get("DENO_KV_ACCESS_TOKEN");
        try {
          if (tempToken) {
            Deno.env.set("DENO_KV_ACCESS_TOKEN", tempToken);
          }
          kv = await Deno.openKv(database.path);
          DatabaseRepository.memoryInstances.set(database.id, kv);
          if (database.lastError) {
            this.kvdex.databases.update(
              database.id,
              { lastError: "", lastErrorAt: new Date(0) },
            ).catch(() => {});
          }
        } catch (err: unknown) { // Catch errors for remote too
          const message = err instanceof Error ? err.message : String(err);
          try {
            await this.kvdex.databases.update(database.id, {
              lastError: message,
              lastErrorAt: new Date(),
            });
          } catch (_) { /* ignore */ }
          throw err; // Rethrow
        } finally {
          // Restore original token
          if (originalToken !== undefined) {
            Deno.env.set("DENO_KV_ACCESS_TOKEN", originalToken);
          } else {
            Deno.env.delete("DENO_KV_ACCESS_TOKEN");
          }
        }
      }
      return kv;
    }
    throw new DatabaseError(
      `Database with id "${database.id}" does not have a valid type`,
    );
  }
  private static activeScans = new Set<string>();
  public static memoryInstances = new Map<string, Deno.Kv>();
  /**
   * Calculates the approximate size of a value in bytes.
   *
   * @param value - Value to measure.
   * @returns Approximate size in bytes.
   */
  public calculateValueSize(value: unknown): number {
    return this.explorer.calculateSize(value);
  }

  /**
   * Calculates statistics for a database, including record count and size.
   * Performs an O(N) scan of the database or a specific prefix.
   *
   * @param id - Database slug or ID.
   * @param pathInfo - Optional path prefix to scan.
   * @param userId - Optional user ID for scan concurrency tracking.
   * @param timeoutMs - Optional scan timeout in milliseconds.
   * @returns Calculated database statistics.
   * @throws {DatabaseError} If a scan is already in progress or database connection fails.
   */
  async getDatabaseStats(
    id: string,
    pathInfo?: string,
    userId?: string,
    timeoutMs?: number,
  ) {
    if (userId) {
      if (DatabaseRepository.activeScans.has(userId)) {
        throw new DatabaseError(
          "A statistics scan is already in progress for your account. Please wait for it to complete.",
        );
      }
      DatabaseRepository.activeScans.add(userId);
    }
    try {
      const dbDoc = await this.getDatabaseBySlugOrId(id);
      const kv = await this.connectDatabase(dbDoc.flat());
      const explorer = new KvExplorer(kv);
      const prefix = pathInfo ? explorer.parsePath(pathInfo) : [];
      let recordCount = 0;
      let sizeBytes = 0;
      const typeDistribution: Record<string, number> = {};
      const childStats: Record<
        string,
        { count: number; size: number; part: ApiKvKeyPart }
      > = {};
      const startTime = performance.now();
      const TIMEOUT_MS = (timeoutMs !== undefined)
        ? timeoutMs
        : (dbDoc.value.settings?.scanTimeout || 30) * 1000;
      let isPartial = false;
      const iter = kv.list({ prefix });
      for await (const entry of iter) {
        // Check for timeout
        if (performance.now() - startTime > TIMEOUT_MS) {
          isPartial = true;
          break;
        }
        recordCount++;
        const valEncoded = ValueCodec.encode(entry.value);
        const size = explorer.calculateSize(entry.value);
        sizeBytes += size;
        // Track type distribution
        const type = valEncoded.type;
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        // Track direct children stats for "Top Nodes"
        if (entry.key.length > prefix.length) {
          const childPart = entry.key[prefix.length];
          // Use native JSON stringify for the key part to ensure absolute stability in the map
          const childKeyStr = KeyCodec.encode([
            this.serializeKeyPart(childPart),
          ]);
          if (!childStats[childKeyStr]) {
            childStats[childKeyStr] = {
              count: 0,
              size: 0,
              part: this.serializeKeyPart(childPart),
            };
          }
          childStats[childKeyStr].count++;
          childStats[childKeyStr].size += size;
        }
      }
      // Convert childStats to a sorted array and limit to top 20
      const topChildren = Object.values(childStats)
        .sort((a, b) => b.size - a.size)
        .slice(0, 20)
        .map((stats) => ({
          key: stats.part,
          size: stats.size,
          count: stats.count,
        }));
      const stats = {
        recordCount,
        sizeBytes,
        updatedAt: new Date(),
        isPartial,
        path: pathInfo,
        breakdown: typeDistribution,
        topChildren,
      };
      // Only update the main DB stats if we scanned the root
      if (!pathInfo) {
        const fullData = { ...dbDoc.flat(), stats: stats as Database["stats"] };
        await this.kvdex.databases.update(
          dbDoc.id,
          fullData,
          { strategy: "replace" },
        );
      }
      return stats;
    } finally {
      if (userId) {
        DatabaseRepository.activeScans.delete(userId);
      }
    }
  }
  serializeKeyPart(part: Deno.KvKeyPart): ApiKvKeyPart {
    return KeySerialization.serialize(part);
  }

  private serializeKey(key: Deno.KvKey): ApiKvKeyPart[] {
    return key.map((p) => this.serializeKeyPart(p));
  }
  parseKeyPart(part: ApiKvKeyPart): Deno.KvKeyPart {
    return KeySerialization.parse(part);
  }
  async getTree(
    slug: string,
    prefix: Deno.KvKey = [],
    options: {
      recursive?: boolean;
      loadValues?: boolean;
      loadDetails?: boolean;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const databaseDoc = await this.getDatabaseBySlugOrId(slug);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    const result = await explorer.getTree(prefix, options);
    return result;
  }
  async getNodes(
    databaseId: string,
    parentPath: Deno.KvKey,
    options: { cursor?: string; limit?: number } = {},
  ) {
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    return await explorer.getTopLevelKeys(parentPath, options);
  }
  async getEntry(slug: string, key: Deno.KvKey) {
    const databaseDoc = await this.getDatabaseBySlugOrId(slug);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const res = await kv.get(key);
    return res;
  }
  async setEntry(slug: string, key: Deno.KvKey, value: unknown) {
    await this.ensureWritable(slug);
    const databaseDoc = await this.getDatabaseBySlugOrId(slug);
    const kv = await this.connectDatabase(databaseDoc.flat());
    return await kv.set(key, value);
  }
  async addAuditLog(
    log: Omit<AuditLogValue, "timestamp">,
  ) {
    try {
      await this.kvdex.audit_logs.add({
        ...log,
        userId: (log.userId as string | undefined) || "system",
        timestamp: new Date(),
      } as AuditLogValue);
    } catch (err) {
      console.error("Failed to add audit log:", err);
    }
  }
  async getAuditLogs(options: {
    userId?: string;
    databaseId?: string;
    action?: string;
    limit?: number;
    cursor?: string;
  } = {}) {
    // kvdex getMany supports secondary index filtering if implemented,
    // but here we might need to use getMany and filter in JS if kvdex version is old.
    // Actually let's use the most efficient way available.
    // For now, we'll list all and filter as kvdex handles the listing.
    // Ideally we'd use findBySecondaryIndex if we only filter by ONE field.
    if (options.userId) {
      return await this.kvdex.audit_logs.findBySecondaryIndex(
        "userId",
        options.userId,
        {
          limit: options.limit,
          cursor: options.cursor,
          reverse: true,
        },
      );
    }
    if (options.databaseId) {
      return await this.kvdex.audit_logs.findBySecondaryIndex(
        "databaseId",
        options.databaseId,
        {
          limit: options.limit,
          cursor: options.cursor,
          reverse: true,
        },
      );
    }
    return await this.kvdex.audit_logs.getMany({
      limit: options.limit,
      cursor: options.cursor,
      reverse: true,
    });
  }
  async purgeAuditLogs(options: { before?: Date; databaseId?: string } = {}) {
    const result = await this.kvdex.audit_logs.deleteMany({
      filter: (doc: any) => {
        if (options.before && doc.value.timestamp >= options.before) {
          return false;
        }
        if (options.databaseId && doc.value.databaseId !== options.databaseId) {
          return false;
        }
        return true;
      },
    });
    const deletedCount = (result as unknown as { count: number }).count ?? 0;
    return { ok: true, deletedCount };
  }
  async deleteEntry(slug: string, key: Deno.KvKey) {
    await this.ensureWritable(slug);
    const databaseDoc = await this.getDatabaseBySlugOrId(slug);
    const kv = await this.connectDatabase(databaseDoc.flat());
    return await kv.delete(key);
  }
  async listEntries(slug: string, options?: Deno.KvListOptions) {
    const databaseDoc = await this.getDatabaseBySlugOrId(slug);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const iter = kv.list({ prefix: [] }, options);
    const entries = [];
    for await (const entry of iter) {
      entries.push(entry);
    }
    return entries;
  }
  async getDatabaseBySlugOrId(slugOrId: string) {
    let database = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      slugOrId,
    );
    if (!database) {
      database = await this.kvdex.databases.find(slugOrId);
    }
    if (!database) {
      throw new DatabaseError(`Database "${slugOrId}" not found`);
    }
    return database;
  }
  async getRecords(
    databaseId: string,
    pathInfo: string,
    cursor?: string,
    limit = 100,
    options: { recursive?: boolean } = {},
  ) {
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    const prefix = pathInfo ? explorer.parsePath(pathInfo) : [];
    return await explorer.getRecords(prefix, { cursor, limit, ...options });
  }
  async searchRecords(
    databaseId: string,
    options: any,
  ) {
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    return await explorer.search([], options);
  }
  async saveRecord(
    databaseId: string,
    key: Deno.KvKey,
    value: unknown,
    versionstamp: string | null = null,
    oldKey?: Deno.KvKey,
    expiresAt?: number | null,
    userId?: string,
    options: { overwrite?: boolean } = {},
  ) {
    await this.ensureWritable(databaseId);
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    // Capture old value for audit log if possible
    let oldValue: RichValue | undefined;
    if (versionstamp || oldKey) {
      const existing = await kv.get(oldKey || key);
      if (existing.value !== null) {
        oldValue = ValueCodec.encode(existing.value);
      }
    }
    // Decode if it's a RichValue from the UI
    let decodedValue = value;
    if (ValueCodec.isRichValue(value)) {
      decodedValue = ValueCodec.decodeForKv(value);
    }
    const expireIn = expiresAt
      ? Math.max(1, expiresAt - Date.now())
      : undefined;

    const overwrite = options.overwrite !== false;

    // Check if target key exists if we are moving or creating and overwrite is false
    if (!overwrite) {
      const target = await kv.get(key);
      if (target.versionstamp !== null) {
        // If we are editing the SAME record (oldKey matches key), this is fine
        const isEditingSame = oldKey &&
          KeyCodec.encode(this.serializeKey(oldKey)) ===
            KeyCodec.encode(this.serializeKey(key));
        if (!isEditingSame) {
          throw new DatabaseError("Target record already exists", {
            existing: {
              key: key.map((p) => this.serializeKeyPart(p)),
              value: ValueCodec.encode(target.value),
              versionstamp: target.versionstamp,
            },
          });
        }
      }
    }

    if (
      oldKey &&
      KeyCodec.encode(this.serializeKey(oldKey)) !==
        KeyCodec.encode(this.serializeKey(key))
    ) {
      // Move record atomically
      const atomic = kv.atomic();
      if (versionstamp) {
        // Check versionstamp of the SOURCE record
        atomic.check({ key: oldKey, versionstamp });
      }
      if (!overwrite) {
        // Double check target doesn't exist in the same transaction
        atomic.check({ key: key, versionstamp: null });
      }

      const result = await atomic
        .delete(oldKey)
        .set(key, decodedValue, { expireIn })
        .commit();

      if (!result.ok) {
        throw new DatabaseError("Transaction failed (likely version conflict)");
      }
      return result;
    }

    if (versionstamp) {
      // Check for conflict on existing key
      const existing = await kv.get(key);
      if (existing.versionstamp !== versionstamp) {
        throw new DatabaseError("Versionstamp conflict");
      }
    }

    const result = await kv.set(key, decodedValue, { expireIn });
    if (result.ok) {
      this.addAuditLog({
        userId,
        databaseId: databaseDoc.id,
        action: oldKey ? "move" : "set",
        key: [...key] as any,
        oldValue: oldValue as any,
        newValue: ValueCodec.encode(decodedValue) as any,
        details: (oldKey
          ? {
            oldKey: oldKey.map((p) => this.serializeKeyPart(p)),
            versionstamp,
          }
          : { versionstamp }) as any,
      });
    }
    return result;
  }
  async incrementRecord(
    databaseId: string,
    key: Deno.KvKey,
    amount: bigint,
    userId?: string,
  ) {
    await this.ensureWritable(databaseId);
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const result = await kv.atomic().sum(key, amount).commit();
    if (result.ok) {
      this.addAuditLog({
        userId,
        databaseId: databaseDoc.id,
        action: "increment",
        key: [...key] as any,
        newValue: ValueCodec.encode(amount) as any,
        details: { amount: String(amount) } as any,
      });
    }
    return result;
  }
  async deleteRecord(databaseId: string, key: Deno.KvKey, userId?: string) {
    await this.ensureWritable(databaseId);
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const existing = await kv.get(key);
    const result = await kv.delete(key);
    this.addAuditLog({
      userId,
      databaseId: databaseDoc.id,
      action: "delete",
      key: [...key] as any,
      oldValue: (existing.value !== null
        ? ValueCodec.encode(existing.value)
        : undefined) as any,
    });
    return result;
  }
  async deleteRecords(
    databaseId: string,
    options: {
      keys?: Deno.KvKey[];
      all?: boolean;
      pathInfo?: string;
      recursive?: boolean;
    },
    userId?: string,
  ) {
    await this.ensureWritable(databaseId);
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    this.addAuditLog({
      userId,
      databaseId: databaseDoc.id,
      action: "delete",
      key:
        (options.pathInfo ? explorer.parsePath(options.pathInfo) : []) as any,
      details: { ...options } as any,
    });
    if (options.all) {
      const prefix = options.pathInfo
        ? explorer.parsePath(options.pathInfo)
        : [];
      return await explorer.deleteRecords(prefix, options.recursive ?? true);
    }
    if (options.keys) {
      for (const key of options.keys) {
        await kv.delete(key);
      }
    }
    return { ok: true };
  }
  async moveRecords(
    databaseId: string,
    options: {
      oldPath?: string;
      keys?: Deno.KvKey[];
      newPath: string;
      recursive?: boolean;
      targetId?: string;
      sourcePath?: string;
    },
    userId?: string,
  ) {
    await this.ensureWritable(databaseId);
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    this.addAuditLog({
      userId,
      databaseId: databaseDoc.id,
      action: "move",
      key: (options.newPath ? explorer.parsePath(options.newPath) : []) as any,
      details: { ...options } as any,
    });
    let targetKv: Deno.Kv | undefined;
    if (options.targetId && options.targetId !== databaseId) {
      await this.ensureWritable(options.targetId);
      const targetDbDoc = await this.getDatabaseBySlugOrId(options.targetId);
      targetKv = await this.connectDatabase(targetDbDoc.flat());
    }
    const newPrefix = explorer.parsePath(options.newPath);
    if (options.oldPath) {
      const oldPrefix = explorer.parsePath(options.oldPath);
      return await explorer.moveRecords(
        oldPrefix,
        newPrefix,
        options.recursive ?? true,
        targetKv,
        { batchSize: databaseDoc.value.settings?.batchSize },
      );
    }
    if (options.keys) {
      let totalMoved = 0;
      const sourcePrefix = options.sourcePath
        ? explorer.parsePath(options.sourcePath)
        : [];
      for (const key of options.keys) {
        // If key starts with sourcePrefix, preserve the relative part
        let relativeKey = [key[key.length - 1]];
        if (
          key.length > sourcePrefix.length &&
          key.slice(0, sourcePrefix.length).every((p, i) => {
            const partA = KeySerialization.serialize(p);
            const partB = KeySerialization.serialize(sourcePrefix[i]);
            return KeyCodec.encode([partA]) === KeyCodec.encode([partB]);
          })
        ) {
          relativeKey = key.slice(sourcePrefix.length);
        }
        const result = await explorer.moveRecords(
          key,
          [...newPrefix, ...relativeKey],
          options.recursive ?? true,
          targetKv,
          { batchSize: databaseDoc.value.settings?.batchSize },
        );
        totalMoved += result.movedCount;
      }
      return { ok: true, movedCount: totalMoved };
    }
    throw new DatabaseError("Either oldPath or keys must be provided");
  }
  async copyRecords(
    databaseId: string,
    options: {
      oldPath?: string;
      keys?: Deno.KvKey[];
      newPath: string;
      recursive?: boolean;
      targetId?: string;
      sourcePath?: string;
    },
    userId?: string,
  ) {
    if (!options.targetId || options.targetId === databaseId) {
      await this.ensureWritable(databaseId);
    }
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    this.addAuditLog({
      userId,
      databaseId: databaseDoc.id,
      action: "copy",
      key: (options.newPath ? explorer.parsePath(options.newPath) : []) as any,
      details: { ...options } as any,
    });
    let targetKv: Deno.Kv | undefined;
    if (options.targetId && options.targetId !== databaseId) {
      await this.ensureWritable(options.targetId);
      const targetDbDoc = await this.getDatabaseBySlugOrId(options.targetId);
      targetKv = await this.connectDatabase(targetDbDoc.flat());
    }
    const newPrefix = explorer.parsePath(options.newPath);
    if (options.oldPath) {
      const oldPrefix = explorer.parsePath(options.oldPath);
      return await explorer.copyRecords(
        oldPrefix,
        newPrefix,
        options.recursive ?? false,
        targetKv,
        { batchSize: databaseDoc.value.settings?.batchSize },
      );
    }
    if (options.keys) {
      let totalCopied = 0;
      const sourcePrefix = options.sourcePath
        ? explorer.parsePath(options.sourcePath)
        : [];
      for (const key of options.keys) {
        // If key starts with sourcePrefix, preserve the relative part
        let relativeKey = [key[key.length - 1]];
        if (
          key.length > sourcePrefix.length &&
          key.slice(0, sourcePrefix.length).every((p, i) => {
            const partA = KeySerialization.serialize(p);
            const partB = KeySerialization.serialize(sourcePrefix[i]);
            return KeyCodec.encode([partA]) === KeyCodec.encode([partB]);
          })
        ) {
          relativeKey = key.slice(sourcePrefix.length);
        }
        const result = await explorer.copyRecords(
          key,
          [...newPrefix, ...relativeKey],
          options.recursive ?? false,
          targetKv,
          { batchSize: databaseDoc.value.settings?.batchSize },
        );
        totalCopied += result.copiedCount;
      }
      return { ok: true, copiedCount: totalCopied };
    }
    throw new DatabaseError("Either oldPath or keys must be provided");
  }
  async exportRecords(
    databaseId: string,
    options: {
      pathInfo?: string;
      recursive?: boolean;
      keys?: Deno.KvKey[];
      all?: boolean;
    } = {},
  ) {
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    if (options.keys) {
      const results = [];
      for (const key of options.keys) {
        const res = await kv.get(key);
        if (res.value !== null) {
          results.push({
            key: key.map((k) => this.serializeKeyPart(k)),
            value: ValueCodec.encode(res.value),
          });
        }
      }
      return results;
    }
    const prefix = options.pathInfo ? explorer.parsePath(options.pathInfo) : [];
    return await explorer.exportToJson(prefix, options.recursive ?? true);
  }
  async importRecords(
    databaseId: string,
    entries: any[],
    userId?: string,
  ) {
    await this.ensureWritable(databaseId);
    const databaseDoc = await this.getDatabaseBySlugOrId(databaseId);
    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    const result = await explorer.importFromJson(entries);
    this.addAuditLog({
      userId,
      databaseId: databaseDoc.id,
      action: "import",
      key: [],
      details: { count: result.importedCount } as any,
    });
    return result;
  }
  private async ensureWritable(slug: string) {
    const dbDoc = await this.getDatabaseBySlugOrId(slug);
    if (dbDoc.flat().mode === "r") {
      throw new DatabaseError(
        `Database "${dbDoc.flat().name || dbDoc.id}" is read-only`,
      );
    }
  }
}
