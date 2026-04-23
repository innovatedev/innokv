import { Database, DatabaseDoc, DatabaseModel } from "@/kv/models.ts";
import { ApiKvKeyPart } from "./types.ts";
import { KvExplorer } from "./KvExplorer.ts";
import { BaseRepository, DatabaseError } from "./BaseRepository.ts";
import { ROOT_DB_ID } from "@/kv/db.ts";

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

    const databaseFromModel = DatabaseModel.safeParse(data);
    if (!databaseFromModel.success) {
      console.error(
        "ERROR: Failed to validate database:",
        databaseFromModel.error,
      );
      throw new DatabaseError(
        `Invalid database data: ${databaseFromModel.error.message}`,
      );
    }

    const record = databaseFromModel.data;
    const database = await this.kvdex.databases.add(record);

    if (!database.ok) {
      console.error("ERRFailed to create database:", databaseFromModel);
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
    const databaseFromModel = DatabaseModel.partial().safeParse(data);
    if (!databaseFromModel.success) {
      console.error(
        "ERROR: Failed to validate database update:",
        databaseFromModel.error,
      );
      throw new DatabaseError(
        `Invalid database data: ${databaseFromModel.error.message}`,
      );
    }

    const record = databaseFromModel.data;
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

  async connectDatabase(database: DatabaseDoc): Promise<Deno.Kv> {
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

  stringifyKeyPart(part: Deno.KvKeyPart) {
    if (typeof part === "string") {
      return { value: part, type: "string" };
    } else if (typeof part === "number") {
      return { value: part.toString(), type: "number" };
    } else if (typeof part === "boolean") {
      return { value: part ? "true" : "false", type: "boolean" };
    } else if (typeof part === "bigint") {
      return { value: part.toString(), type: "bigint" }; // Added bigint support
    } else if (part instanceof Uint8Array) {
      return { value: btoa(String.fromCharCode(...part)), type: "Uint8Array" };
    } else {
      // For types that are not strictly KvKeyPart but we might encounter due to looser typing
      // deno-lint-ignore no-explicit-any
      const p = part as any;
      if (p instanceof Date) {
        return { value: p.toISOString(), type: "Date" };
      }
      if (p instanceof ArrayBuffer) {
        return {
          value: btoa(String.fromCharCode(...new Uint8Array(p))),
          type: "ArrayBuffer",
        };
      }
      if (Array.isArray(p)) {
        return { value: JSON.stringify(p), type: "Array" };
      }
      throw new Error(`Unsupported key part type: ${typeof part}`);
    }
  }

  parseKeyPart(part: ApiKvKeyPart): Deno.KvKeyPart {
    switch (part.type) {
      case "string":
        return part.value;
      case "number":
        return Number(part.value);
      case "boolean":
        return part.value === "true";
      case "bigint":
        return BigInt(part.value);
      case "Date":
        // deno-lint-ignore no-explicit-any
        return new Date(part.value) as any;
      case "Uint8Array":
        return Uint8Array.from(atob(part.value), (c) => c.charCodeAt(0));
      case "ArrayBuffer":
        return Uint8Array.from(atob(part.value), (c) => c.charCodeAt(0))
          // deno-lint-ignore no-explicit-any
          .buffer as any;
      case "Array":
        // deno-lint-ignore no-explicit-any
        return JSON.parse(part.value) as any;
      default:
        throw new Error(`Unsupported key part type: ${part.type}`);
    }
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
    const databaseDoc = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      slug,
    );
    if (!databaseDoc) {
      throw new DatabaseError(`Database with slug "${slug}" not found`);
    }

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
    const databaseDoc = await this.getDatabase(databaseId);
    if (!databaseDoc) throw new DatabaseError("Database not found");

    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);

    return await explorer.getTopLevelKeys(parentPath, options);
  }

  async getEntry(slug: string, key: Deno.KvKey) {
    const databaseDoc = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      slug,
    );
    if (!databaseDoc) {
      throw new DatabaseError(`Database with slug "${slug}" not found`);
    }

    const kv = await this.connectDatabase(databaseDoc.flat());
    const res = await kv.get(key);
    return res;
  }

  async setEntry(slug: string, key: Deno.KvKey, value: unknown) {
    const databaseDoc = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      slug,
    );
    if (!databaseDoc) {
      throw new DatabaseError(`Database with slug "${slug}" not found`);
    }

    const kv = await this.connectDatabase(databaseDoc.flat());
    return await kv.set(key, value);
  }

  async deleteEntry(slug: string, key: Deno.KvKey) {
    const databaseDoc = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      slug,
    );
    if (!databaseDoc) {
      throw new DatabaseError(`Database with slug "${slug}" not found`);
    }

    const kv = await this.connectDatabase(databaseDoc.flat());
    return await kv.delete(key);
  }

  async listEntries(slug: string, options?: Deno.KvListOptions) {
    const databaseDoc = await this.kvdex.databases.findByPrimaryIndex(
      "slug",
      slug,
    );
    if (!databaseDoc) {
      throw new DatabaseError(`Database with slug "${slug}" not found`);
    }

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
    const databaseDoc = await this.getDatabase(databaseId);
    if (!databaseDoc) throw new DatabaseError("Database not found");

    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);
    const prefix = pathInfo ? explorer.parsePath(pathInfo) : [];

    return await explorer.getRecords(prefix, { cursor, limit, ...options });
  }

  async saveRecord(
    databaseId: string,
    key: Deno.KvKey,
    value: unknown,
    versionstamp: string | null = null,
    oldKey?: Deno.KvKey,
  ) {
    const databaseDoc = await this.getDatabase(databaseId);
    if (!databaseDoc) throw new DatabaseError("Database not found");

    const kv = await this.connectDatabase(databaseDoc.flat());

    if (oldKey && JSON.stringify(oldKey) !== JSON.stringify(key)) {
      // Move record
      await kv.delete(oldKey);
    }

    if (versionstamp) {
      // Check for conflict
      const existing = await kv.get(key);
      if (existing.versionstamp !== versionstamp) {
        throw new DatabaseError("Versionstamp conflict");
      }
    }

    return await kv.set(key, value);
  }

  async deleteRecord(databaseId: string, key: Deno.KvKey) {
    const databaseDoc = await this.getDatabase(databaseId);
    if (!databaseDoc) throw new DatabaseError("Database not found");

    const kv = await this.connectDatabase(databaseDoc.flat());
    return await kv.delete(key);
  }

  async deleteRecords(
    databaseId: string,
    options: {
      keys?: Deno.KvKey[];
      all?: boolean;
      pathInfo?: string;
      recursive?: boolean;
    },
  ) {
    const databaseDoc = await this.getDatabase(databaseId);
    if (!databaseDoc) throw new DatabaseError("Database not found");

    const kv = await this.connectDatabase(databaseDoc.flat());
    const explorer = new KvExplorer(kv);

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

  static memoryInstances = new Map<string, Deno.Kv>();
}
