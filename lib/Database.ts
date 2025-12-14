import { Database, DatabaseModel } from "./models.ts";
import { ApiKvKeyPart } from "./types.ts";
import { KeyCodec } from "./KeyCodec.ts";
import { KvExplorer } from "./KvExplorer.ts";
import { BaseRepository, DatabaseError } from "./BaseRepository.ts";

export class DatabaseRepository extends BaseRepository {
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

    const record = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      sort: data.sort || 0,
    };
    const databaseFromModel = this.parseModel(DatabaseModel, record);

    const database = await this.kvdex.databases.add(record);

    if (!database.ok) {
      console.error("ERRFailed to create database:", databaseFromModel);
      throw new DatabaseError(
        `Failed to create database: ${
          (database as any).error || "Unknown error"
        }`,
      );
    }

    return {
      ...database,
      ...record,
    };
  }

  async updateDatabase(data: Database & { existingSlug: string }) {
    const { id, ...update } = data;
    const existingDatabase = await this.kvdex.databases.find(id);

    if (!existingDatabase) {
      throw new DatabaseError(`Database with id "${id}" does not exist`);
    }

    const record = {
      ...existingDatabase.value,
      ...update,
      updatedAt: new Date(),
    };
    const databaseFromModel = this.parseModel(DatabaseModel, record);

    // cannot update if slug hasn't changed
    const { slug: newSlug, path: _newPath } = record;
    if (existingDatabase.value.slug == newSlug) {
      // record.slug = crypto.randomUUID();
      // record.path = crypto.randomUUID();
    }
    // Exclude slug from update payload as it is a primary index and shouldn't be in the update data unless changing (which requires special handling)
    // For now, we assume slug doesn't change or we explicitly exclude it to fix the update error.
    const { slug: _slug, ...updateData } = databaseFromModel;
    const database = await this.kvdex.databases.update(id, updateData);

    if (!database.ok) {
      console.error("ERROR: Failed to update database:", record, database);
      throw new DatabaseError(
        `Failed to update database: ${
          (database as any).error || "Unknown error"
        }`,
      );
    }

    // if (newSlug != record.slug) {
    //   record.slug = newSlug;
    //   // record.path = newPath;
    //   await this.kvdex.databases.update(id, record);
    // }

    return {
      id,
      ...record,
    };
  }

  async deleteDatabase({ id }: { id: string }) {
    const database = await this.kvdex.databases.find(id);

    if (!database) {
      throw new DatabaseError(`Database with id "${id}" does not exist`);
    }

    await this.kvdex.databases.delete(id);

    return { ok: true, name: database.value.name || database.id };
  }

  async getDatabases(
    { reverse = false, limit = 100 }: { reverse?: boolean; limit?: number } = {
      reverse: false,
      limit: 100,
    },
  ) {
    const databases = await this.kvdex.databases.getManyBySecondaryOrder(
      "sort",
      {
        reverse,
        limit,
      },
    );

    return databases;
  }

  async getDatabase(id: string) {
    const database = await this.kvdex.databases.find(id);

    if (!database) {
      throw new DatabaseError(`Database with id "${id}" does not exist`);
    }

    return database;
  }

  async getDatabaseBySlugOrId(slugOrId: string) {
    // Try by slug first (primary index)
    const bySlug = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      slugOrId,
    );
    if (bySlug) return bySlug;

    // Try by ID
    const byId = await this.kvdex.databases.find(slugOrId);
    if (byId) return byId;

    throw new DatabaseError(
      `Database with slug or id "${slugOrId}" does not exist`,
    );
  }

  private static memoryInstances = new Map<string, Deno.Kv>();

  async connectDatabase(database: Database) {
    if (database.type === "file") {
      const { path } = database;
      if (!path) {
        throw new DatabaseError(
          `Database with id "${database.id}" does not have a path`,
        );
      }

      const kv = await Deno.openKv(path);
      if (!kv) {
        throw new DatabaseError(`Failed to open database at path "${path}"`);
      }

      return kv;
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

  stringifyKeyPart(part: Deno.KvKeyPart) {
    if (typeof part === "string") {
      return { value: part, type: "string" };
    } else if (typeof part === "number") {
      return { value: part.toString(), type: "number" };
    } else if (typeof part === "boolean") {
      return { value: part ? "true" : "false", type: "boolean" };
    } else if (typeof part === "bigint") {
      return { value: part.toString(), type: "bigint" }; // Added bigint support
    } else if (part instanceof Date) {
      return { value: part.toISOString(), type: "Date" };
    } else if (part instanceof Uint8Array) {
      return { value: btoa(String.fromCharCode(...part)), type: "Uint8Array" };
    } else if ((part as any) instanceof ArrayBuffer) {
      return {
        value: btoa(String.fromCharCode(...new Uint8Array(part as any))),
        type: "ArrayBuffer",
      };
    } else if (Array.isArray(part)) {
      return { value: JSON.stringify(part), type: "Array" };
    } else {
      throw new Error(`Unsupported key part type: ${typeof part}`);
    }
  }

  parseKeyPart(part: { type: string; value: string }) {
    try {
      if (part.type === "string") {
        return part.value;
      } else if (part.type === "number") {
        return parseFloat(part.value);
      } else if (part.type === "bigint") {
        return BigInt(part.value); // Added bigint support
      } else if (part.type === "boolean") {
        return part.value === "true";
      } else if (part.type === "Date") {
        return new Date(part.value);
      } else if (part.type === "Uint8Array" || part.type === "uint8array") {
        return Uint8Array.from(atob(part.value), (c) => c.charCodeAt(0));
      } else if (part.type === "ArrayBuffer") {
        return Uint8Array.from(atob(part.value), (c) => c.charCodeAt(0)).buffer;
      } else if (part.type === "Array") {
        return JSON.parse(part.value);
      }
    } catch (e) {
      console.error("Failed to parse key part:", e);
    }

    return part.value;
  }

  // Helper to handle BigInt in values during JSON parsing/stringifying if needed by API
  // But here we deal with KV direct access.

  async saveRecord(
    id: string,
    key: Deno.KvKey,
    value: unknown,
    versionstamp: string | null = null,
    oldKey?: Deno.KvKey,
  ) {
    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });

    if (oldKey) {
      const isSameKey = this.keysEqual(key, oldKey);
      if (!isSameKey) {
        const atomic = kv.atomic();
        if (versionstamp) atomic.check({ key: oldKey, versionstamp });
        atomic.delete(oldKey);
        atomic.set(key, value);
        const result = await atomic.commit();
        if (!result.ok) {
          throw new Error(
            "Failed to move record: version check failed or conflict",
          );
        }
        return result;
      }
    }

    if (versionstamp) {
      const atomic = kv.atomic();
      atomic.check({ key, versionstamp });
      atomic.set(key, value);
      const result = await atomic.commit();
      if (!result.ok) {
        throw new Error("Failed to save record: version check failed");
      }
      return result;
    }

    return await kv.set(key, value);
  }

  async deleteRecord(id: string, key: Deno.KvKey) {
    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });
    await kv.delete(key);
    return { ok: true };
  }

  async deleteRecords(
    id: string,
    { keys, all, pathInfo, recursive }: {
      keys?: Deno.KvKey[];
      all?: boolean;
      pathInfo?: string;
      recursive?: boolean;
    },
  ) {
    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });

    let keysToDelete: Deno.KvKey[] = [];

    if (all && pathInfo !== undefined) {
      const pathInfoParsed = KeyCodec.decode(pathInfo);
      const prefix = pathInfoParsed.map((info) => this.parseKeyPart(info));
      const iter = kv.list({ prefix });
      for await (const entry of iter) {
        if (recursive === false) {
          if (entry.key.length > prefix.length + 1) continue;
        }
        keysToDelete.push(entry.key);
      }
    } else if (keys) {
      keysToDelete = keys;
    }

    // Batched delete
    // Deno KV atomic supports limited ops (10 per atomic usually).
    // Now that key serialization is fixed, we can safely use atomic batches for better performance (fewer commits).
    const BATCH_SIZE = 10;
    let deletedCount = 0;

    for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
      const batch = keysToDelete.slice(i, i + BATCH_SIZE);
      const atomic = kv.atomic();
      for (const key of batch) {
        atomic.delete(key);
      }
      const result = await atomic.commit();
      if (result.ok) {
        deletedCount += batch.length;
      } else {
        console.error("Failed to delete batch of records", result);
      }
    }
    return { ok: true, count: deletedCount };
  }

  async updateLastAccessed(id: string) {
    try {
      const database = await this.getDatabaseBySlugOrId(id);
      // getDatabaseBySlugOrId throws if not found

      // We need the real ID for the update operation
      const realId = database.id;
      const { slug: _slug, ...data } = database.value;

      await this.kvdex.databases.update(realId, {
        ...data,
        lastAccessedAt: new Date(),
      });
    } catch (e) {
      // Ignore update errors for lastAccessedAt to prevent blocking reads
      console.warn(`Failed to update lastAccessedAt for db ${id}`, e);
    }
  }

  async getNodes(
    id: string,
    parentPath: ApiKvKeyPart[] = [],
    options: { limit?: number; cursor?: string } = {},
  ) {
    // Mark as accessed
    this.updateLastAccessed(id); // updateLastAccessed also needs slug support? see below.

    const database = await this.getDatabaseBySlugOrId(id);
    const kv = await this.connectDatabase({
      ...database.value,
      id: database.id,
    });
    const explorer = new KvExplorer(kv);

    // Decode parent path to KV Key
    const prefix = parentPath.map((p) => this.parseKeyPart(p));

    const { keys, cursor } = await explorer.getTopLevelKeys(prefix, options);

    return { nodes: keys, cursor };
  }

  async getRecords(
    id: string,
    pathInfo: string,
    cursor?: string,
    limit = 100,
    options: { recursive?: boolean } = {}, // New options param
  ) {
    const pathInfoParsed = KeyCodec.decode(pathInfo);
    const database = await this.getDatabaseBySlugOrId(id);
    const kv = await this.connectDatabase({
      ...database.value,
      id: database.id,
    });
    const explorer = new KvExplorer(kv);

    const prefix = pathInfoParsed.map((info) => this.parseKeyPart(info));

    const { records, cursor: nextCursor } = await explorer.getRecords(prefix, {
      limit,
      cursor,
      recursive: options.recursive ?? true,
    });

    const parsedRecords = records.map((entry) => {
      const parsedKey = entry.key.map((part) => this.stringifyKeyPart(part));
      return {
        key: parsedKey as any,
        value: entry.value,
        versionstamp: entry.versionstamp,
      };
    });

    return { records: parsedRecords, cursor: nextCursor };
  }

  private keysEqual(a: Deno.KvKey, b: Deno.KvKey): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const valA = a[i];
      const valB = b[i];
      if (valA === valB) continue;
      if (valA instanceof Uint8Array && valB instanceof Uint8Array) {
        if (valA.length !== valB.length) return false;
        for (let j = 0; j < valA.length; j++) {
          if (valA[j] !== valB[j]) return false;
        }
        continue;
      }
      return false;
    }
    return true;
  }
}
