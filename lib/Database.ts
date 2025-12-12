import { Database, DatabaseModel } from "./models.ts";
import { KeyCodec } from "./KeyCodec.ts";
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

    return database;
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
    let { slug: newSlug, path: newPath } = record;
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

    return database;
  }

  async deleteDatabase({ id }: { id: string }) {
    const database = await this.kvdex.databases.find(id);

    if (!database) {
      throw new DatabaseError(`Database with id "${id}" does not exist`);
    }

    await this.kvdex.databases.delete(id);

    return { ok: true };
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
      return await Deno.openKv(":memory:");
    } else if (database.type === "remote") {
      if (!database.path) {
        throw new DatabaseError(
          `Database with id "${database.id}" does not have a path (UUID)`,
        );
      }
      return await Deno.openKv(database.path);
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
    } else if (part instanceof ArrayBuffer) {
      return {
        value: btoa(String.fromCharCode(...new Uint8Array(part))),
        type: "ArrayBuffer",
      };
    } else if (Array.isArray(part)) { // Fixed instanceof check
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
    return part.value; // Return value directly if no type match? Or fallback.
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
      // Check if key is actually different
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

  async updateLastAccessed(id: string) {
    try {
      const database = await this.kvdex.databases.find(id);
      if (!database) return;

      const { slug: _slug, ...data } = database.value;
      await this.kvdex.databases.update(id, {
        ...data,
        lastAccessedAt: new Date(),
      });
    } catch (e) {
      // Ignore update errors for lastAccessedAt to prevent blocking reads
      console.warn(`Failed to update lastAccessedAt for db ${id}`, e);
    }
  }

  async getKeys(id: string) {
    // Mark as accessed when opening the DB keys
    await this.updateLastAccessed(id);

    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });

    // [Rest of key fetching logic...]
    const keys: Record<string, any> = {};
    const iter = kv.list({ prefix: [] }, { limit: 1000 }); // Limit for safety
    for await (const entry of iter) {
      const { key } = entry;
      let parent = keys;
      for (let i = 0; i < key.length; i++) {
        const part = key[i];
        const info = this.stringifyKeyPart(part); // Fixed: remove 2nd arg
        const mapKey = JSON.stringify({ type: info.type, value: info.value });

        if (!(mapKey in parent)) {
          parent[mapKey] = { ...info, children: {} };
        }
        parent = parent[mapKey].children;
      }
    }
    return keys;
  }

  async getRecords(id: string, pathInfo: string, cursor?: string) {
    const pathInfoParsed = KeyCodec.decode(pathInfo);
    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });

    const keys: Deno.KvKey = pathInfoParsed.map((info) =>
      this.parseKeyPart(info)
    );

    // List records with prefix
    const result = kv.list({ prefix: keys }, { cursor, limit: 100 });

    const records: Deno.KvEntry<unknown>[] = [];
    for await (const record of result) {
      const { key, value, versionstamp } = record;

      // Existing logic filtered for direct children?
      // "if (key.length === keys.length + 1)" gets only immediate children.
      // I will keep that as it likely supports the "Folder" navigation style.
      if (key.length === keys.length + 1) {
        // We must serialize the key parts to send over API
        const parsedKey = key.map((part) => this.stringifyKeyPart(part));
        records.push({ key: parsedKey as any, value, versionstamp });
      }
    }

    return records;
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
