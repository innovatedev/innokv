import { Database, DatabaseModel } from "./models.ts";
import { ApiKvKeyPart, DbNode } from "./types.ts";
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

    return { ok: true, name: database.value.name || database.value.id };
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

  // Persistent cache for memory databases (keyed by Database ID)
  // This ensures that memory databases persist across requests within the same server process.
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
      // Fetch all keys matching prefix
      const pathInfoParsed = KeyCodec.decode(pathInfo);
      const prefix = pathInfoParsed.map((info) => this.parseKeyPart(info));
      const iter = kv.list({ prefix });
      for await (const entry of iter) {
        // If recursive is explicitly false, skip nested keys (depth > prefix + 1)
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

  async getNodes(id: string, parentPath: ApiKvKeyPart[] = []) {
    // Mark as accessed
    this.updateLastAccessed(id);

    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });

    // Decode parent path to KV Key
    const prefix = parentPath.map((p) => this.parseKeyPart(p));
    const depth = prefix.length;

    const nodes: DbNode[] = [];

    // Iteration strategy:
    // We want to find all unique key parts at 'depth'.
    // We use a cursor-like approach with 'start' key.

    let currentStart = [...prefix];
    // If prefix is empty, start at beginning.
    // If prefix is not empty, start at prefix (inclusive) -> effectively first child.

    // Sentinel for skipping descendants (works well for String keys)
    // For universal support, we might need a robust 'successor' function.
    // For now, we assume standard string-based hierarchy or accept linear scan for mixed types (unlikely).
    // The "Maximum Possible Value" for a segment.
    // We use boolean 'true' as the sentinel in the iteration logic below.
    // const END_SENTINEL = "\uFFFF\uFFFF\uFFFF\uFFFF";

    // Loop
    let useStart = false;

    while (true) {
      // Use explicit type to allow adding 'start'
      const selector: { prefix: Deno.KvKey; start?: Deno.KvKey } = { prefix };
      if (useStart) selector.start = currentStart;

      // @ts-ignore: selector compatible
      const iter = kv.list(selector, { limit: 1 });
      const entry = await iter.next();

      if (entry.done) break;
      const { key, value } = entry.value;

      // Extract the part at current depth
      // key = [...prefix, part, ...rest]
      if (key.length <= depth) {
        // Should not happen given 'prefix' constraint, unless key == prefix.
        // If key == prefix, it means the directory itself has a value.
        // We handle this? DbNode is usually a child.
        // If the parent itself is a value, it should have been rendered by the parent's parent?
        // But here we are asking for children of 'prefix'.
        // If 'prefix' is a key, iterating 'prefix' returns it first.
        // We should skip it effectively as it is not a "child".
        // Next start: [...prefix, <Lowest possible value>]?
        // Actually, [...prefix, 0] or similar.
        // Let's just create a nextStart that appends a null/low byte?
        // Or if key == prefix, we just move `currentStart` to `[...prefix, <min>]`.
        currentStart = [...prefix, "\x00"]; // Low char
        useStart = true;
        continue;
      }

      const partVal = key[depth];
      console.log(
        `[getNodes] Found part: ${partVal} (type: ${typeof partVal})`,
        { key },
      );

      const partInfo = this.stringifyKeyPart(partVal);
      const partKey = JSON.stringify({
        type: partInfo.type,
        value: partInfo.value,
      });

      // Determine if it has children (is implicit folder)
      let hasChildren = key.length > depth + 1;

      // Heuristic Successor:
      // We use 'true' as the sentinel because Boolean is the highest type in KV sort order.
      // This ensures we skip ALL complex keys start with `[...prefix, partVal, ...]`.
      const nextStart: Deno.KvKey = [...prefix, partVal, true];

      console.log(
        `[getNodes] Calculated nextStart for skipping ${partVal}:`,
        nextStart,
      );
      // Check if we really have children (if we didn't confirm it yet)
      // If key.length == depth + 1, it's a leaf node.
      // But there might be OTHER keys with same prefix that are longer?
      // e.g. ["a"] and ["a", "b"].
      // We found ["a"]. `hasChildren` is false.
      // But `["a", "b"]` exists.
      // We need to know if `["a"]` is a folder.
      // We can peek `kv.list({ prefix: [...prefix, partVal] }, { limit: 2 })`?
      // Too expensive?
      // If we use the skip strategy, we assume we move to next sibling.
      // If the current key was valid, we emit it.

      // Wait, if we emit 'partVal', we need to know `hasChildren` for the UI arrow.
      // If `key.length > depth + 1`, we definitely have children.
      // If `key.length == depth + 1`, we might or might not (if this key is a leaf AND a folder parent).
      // We can check if `nextStart` (skipping descendants) is strictly > `key`.
      // Actually, simplest check:
      // If we are about to skip descendants, it implies there MIGHT be descendants.
      // We can explicitly check for one child?
      // `kv.list({ prefix: [...prefix, partVal], limit: 1, start: [...prefix, partVal, "\x00"] })`.
      // Yes, if we didn't see a deep key yet.

      if (!hasChildren) {
        // Check for existence of children
        const childCheck = kv.list({
          prefix: [...prefix, partVal],
          start: [...prefix, partVal, "\x00"],
        }, { limit: 1 });
        const childEntry = await childCheck.next();
        if (!childEntry.done) {
          hasChildren = true;
        }
      }

      nodes.push({
        ...partInfo,
        hasChildren,
        children: {}, // Empty for lazy load
      });

      // Advance
      currentStart = nextStart;
      useStart = true;
    }

    return nodes;
  }

  // Old getKeys - kept for reference or legacy if needed, but we should switch.
  // ...
  async getKeys(id: string) {
    // Mark as accessed when opening the DB keys
    await this.updateLastAccessed(id);

    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });

    // [Rest of key fetching logic...]
    const keys: Record<string, any> = {};
    const iter = kv.list({ prefix: [] }, { limit: 10000 }); // Partial fix for large DBs: increased limit
    for await (const entry of iter) {
      const { key } = entry;
      // console.log("Found key in DB:", key);
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

  async getRecords(id: string, pathInfo: string, cursor?: string, limit = 100) {
    const pathInfoParsed = KeyCodec.decode(pathInfo);
    const database = await this.getDatabase(id);
    const kv = await this.connectDatabase({ ...database.value, id });

    const prefix = pathInfoParsed.map((info) => this.parseKeyPart(info));
    const depth = prefix.length;

    console.log(
      `[getRecords] Fetching for ${id} prefix:`,
      prefix,
      "limit:",
      limit,
      "cursor:",
      cursor,
    );

    let currentStart = [...prefix];
    if (cursor) {
      try {
        // Try decoding as Key structure first
        const decoded = KeyCodec.decode(cursor);
        currentStart = decoded.map((p) => this.parseKeyPart(p));
        console.log(`[getRecords] Resuming from cursor key:`, currentStart);
      } catch (e) {
        // Fallback for strict opaque cursors?
        // Since we are changing the strategy, opaque cursors from old method won't work.
        // We assume cursor is either empty or a Key string.
        console.warn(
          `[getRecords] Invalid cursor format, resetting to start.`,
          e,
        );
      }
    }

    const records: Deno.KvEntry<unknown>[] = [];

    let nextCursor: string | undefined = undefined;

    // Standard Linear Scan
    // Construct selector safely to avoid "Start key not in keyspace" error if prefix is empty
    const selector: { prefix: Deno.KvKey; start?: Deno.KvKey } = { prefix };
    if (cursor) {
      selector.start = currentStart;
    }

    const iter = kv.list(selector, { limit: limit + 1 });

    for await (const entry of iter) {
      const { key, value, versionstamp } = entry;
      const parsedKey = key.map((part) => this.stringifyKeyPart(part));
      records.push({ key: parsedKey as any, value, versionstamp });
    }

    if (records.length > limit) {
      const nextItem = records.pop();
      if (nextItem) {
        nextCursor = KeyCodec.encode(nextItem.key);
      }
    } else {
      nextCursor = "";
    }

    console.log(
      `[getRecords] Done. Records: ${records.length}. NextCursor: ${nextCursor}`,
    );
    return { records, cursor: nextCursor || "" };
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
