import { type DbNode } from "./types.ts";
import { KeyCodec } from "./KeyCodec.ts";
import { RichValue, ValueCodec } from "./ValueCodec.ts";

export class KvExplorer {
  constructor(private kv: Deno.Kv) {}

  /**
   * Retrieves tree structure under a prefix.
   * Uses a "skip scan" strategy for top-level keys to be efficient.
   */
  async getTree(
    prefix: Deno.KvKey,
    options: {
      limit?: number;
      cursor?: string;
      recursive?: boolean;
      loadValues?: boolean;
      loadDetails?: boolean;
    } = {},
  ): Promise<{ keys: DbNode[]; cursor: string }> {
    if (options.recursive) {
      // For recursive, we could implement a full tree walk
      // but for now we just use the skip scan to get top-level keys
      // and let the UI request more as needed.
    }

    return await this.getTopLevelKeys(prefix, options);
  }

  /**
   * Retrieves top-level keys under a prefix using a "skip scan" strategy.
   * This is efficient for large datasets as it avoids iterating over all children.
   *
   * @param prefix The parent prefix to search under
   * @param limit Maximum number of unique keys to return per batch
   * @param cursor Pagination cursor (serialized Deno.KvKey)
   */
  async getTopLevelKeys(
    prefix: Deno.KvKey,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ keys: DbNode[]; cursor: string }> {
    const limit = options.limit ?? 100;
    const nodes: DbNode[] = [];
    const depth = prefix.length;

    let currentStart: Deno.KvKey;
    if (options.cursor) {
      try {
        currentStart = KeyCodec.decode(options.cursor).map((p) =>
          this.parseKeyPart(p)
          // deno-lint-ignore no-explicit-any
        ) as any as Deno.KvKey;
      } catch {
        currentStart = [...prefix];
      }
    } else {
      currentStart = [...prefix];
    }

    let processedCount = 0;
    let nextCursor = "";

    while (processedCount < limit) {
      const selector: { prefix: Deno.KvKey; start?: Deno.KvKey } = { prefix };
      if (processedCount > 0 || options.cursor) {
        selector.start = currentStart;
      }

      const iter = this.kv.list(selector, { limit: 1 });
      const entry = await iter.next();

      if (entry.done) {
        break;
      }

      const key = entry.value.key;

      if (key.length <= depth) {
        currentStart = [...prefix, new Uint8Array([0])];
        continue;
      }

      const partVal = key[depth];
      const partInfo = this.stringifyKeyPart(partVal);

      let hasChildren = key.length > depth + 1;

      if (!hasChildren) {
        const childIter = this.kv.list({
          prefix: [...prefix, partVal],
          start: [...prefix, partVal, new Uint8Array([0])],
        }, { limit: 1 });
        const childCheck = await childIter.next();
        if (!childCheck.done) {
          hasChildren = true;
        }
      }

      const nextStart = [...prefix, partVal, true];

      nodes.push({
        type: partInfo.type,
        value: partInfo.value,
        hasChildren,
        children: {},
      });

      processedCount++;
      // deno-lint-ignore no-explicit-any
      currentStart = nextStart as any;

      nextCursor = KeyCodec.encode(
        currentStart.map((p) => this.stringifyKeyPart(p)),
      );
    }

    return { keys: nodes, cursor: nodes.length >= limit ? nextCursor : "" };
  }

  /**
   * Retrieves records under a prefix.
   */
  async getRecords(
    prefix: Deno.KvKey,
    options: { limit?: number; cursor?: string; recursive?: boolean } = {},
  ) {
    const limit = options.limit ?? 100;
    const recursive = options.recursive ?? true;

    let start: Deno.KvKey | undefined;
    if (options.cursor) {
      try {
        start = JSON.parse(options.cursor);
      } catch { /* ignore invalid cursor */ }
    }

    const iter = this.kv.list({ prefix, start }, { limit: limit + 1 });
    const records: Deno.KvEntry<unknown>[] = [];

    for await (const entry of iter) {
      if (!recursive) {
        if (entry.key.length > prefix.length + 1) {
          continue;
        }
      }
      records.push(entry);
    }

    let nextCursor = "";
    if (records.length > limit) {
      const next = records.pop();
      if (next) {
        nextCursor = JSON.stringify(next.key);
      }
    }

    const apiRecords = records.map((entry) => ({
      ...entry,
      key: entry.key.map((p) => this.stringifyKeyPart(p)),
      value: ValueCodec.encode(entry.value),
    }));

    return { records: apiRecords, cursor: nextCursor };
  }

  private stringifyKeyPart(
    part: Deno.KvKeyPart,
  ): { value: string; type: string } {
    if (typeof part === "string") {
      return { value: part, type: "string" };
    } else if (typeof part === "number") {
      return { value: part.toString(), type: "number" };
    } else if (typeof part === "boolean") {
      return { value: part ? "true" : "false", type: "boolean" };
    } else if (typeof part === "bigint") {
      return { value: part.toString(), type: "bigint" };
    } else if (ArrayBuffer.isView(part)) {
      const u8 = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
      return { value: btoa(String.fromCharCode(...u8)), type: "Uint8Array" };
    } else {
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
      return { value: String(part), type: "string" };
    }
  }

  private parseKeyPart(part: { type: string; value: string }): Deno.KvKeyPart {
    try {
      if (part.type === "string") {
        return part.value;
      } else if (part.type === "number") {
        return parseFloat(part.value);
      } else if (part.type === "bigint") {
        return BigInt(part.value);
      } else if (part.type === "boolean") {
        return part.value === "true";
      } else if (part.type === "Date") {
        // deno-lint-ignore no-explicit-any
        return new Date(part.value) as any;
      } else if (part.type === "Uint8Array" || part.type === "uint8array") {
        return Uint8Array.from(atob(part.value), (c) => c.charCodeAt(0));
      } else if (part.type === "ArrayBuffer") {
        return Uint8Array.from(atob(part.value), (c) => c.charCodeAt(0))
          // deno-lint-ignore no-explicit-any
          .buffer as any;
      } else if (part.type === "Array") {
        // deno-lint-ignore no-explicit-any
        return JSON.parse(part.value) as any;
      }
    } catch (e) {
      console.error("Failed to parse key part:", e);
    }
    return part.value;
  }

  parsePath(pathInfo: string): Deno.KvKey {
    return KeyCodec.decode(pathInfo).map((p) => this.parseKeyPart(p));
  }

  async deleteRecords(prefix: Deno.KvKey, recursive = true) {
    // Delete the prefix itself if it exists
    if (prefix.length > 0) {
      await this.kv.delete(prefix);
    }

    const iter = this.kv.list({ prefix });
    for await (const entry of iter) {
      if (!recursive && entry.key.length > prefix.length + 1) {
        continue;
      }
      await this.kv.delete(entry.key);
    }
    return { ok: true };
  }

  /**
   * Moves records from one prefix to another.
   * Performs an atomic move (delete + set) for each entry found.
   */
  async moveRecords(
    oldPrefix: Deno.KvKey,
    newPrefix: Deno.KvKey,
    recursive = true,
  ) {
    let movedCount = 0;

    // Handle the prefix key itself
    if (oldPrefix.length > 0) {
      const rootEntry = await this.kv.get(oldPrefix);
      if (rootEntry.value !== null) {
        const res = await this.kv.atomic()
          .delete(oldPrefix)
          .set(newPrefix, rootEntry.value)
          .commit();
        if (res.ok) movedCount++;
      }
    }

    const iter = this.kv.list({ prefix: oldPrefix });

    for await (const entry of iter) {
      if (!recursive && entry.key.length > oldPrefix.length + 1) {
        continue;
      }

      const suffix = entry.key.slice(oldPrefix.length);
      const newKey = [...newPrefix, ...suffix];

      // Atomic move per entry to prevent data loss
      const res = await this.kv.atomic()
        .delete(entry.key)
        .set(newKey, entry.value)
        .commit();

      if (res.ok) {
        movedCount++;
      } else {
        throw new Error(
          `Failed to move record at key: ${JSON.stringify(entry.key)}`,
        );
      }
    }
    return { ok: true, movedCount };
  }

  /**
   * Copies records from one prefix to another.
   */
  async copyRecords(
    oldPrefix: Deno.KvKey,
    newPrefix: Deno.KvKey,
    recursive = false,
  ) {
    let copiedCount = 0;

    // Handle the prefix key itself
    if (oldPrefix.length > 0) {
      const rootEntry = await this.kv.get(oldPrefix);
      if (rootEntry.value !== null) {
        await this.kv.set(newPrefix, rootEntry.value);
        copiedCount++;
      }
    }

    const iter = this.kv.list({ prefix: oldPrefix });

    for await (const entry of iter) {
      if (!recursive && entry.key.length > oldPrefix.length + 1) {
        continue;
      }

      const suffix = entry.key.slice(oldPrefix.length);
      const newKey = [...newPrefix, ...suffix];

      await this.kv.set(newKey, entry.value);
      copiedCount++;
    }
    return { ok: true, copiedCount };
  }

  /**
   * Exports records under a prefix to a JSON-serializable array.
   */
  async exportToJson(prefix: Deno.KvKey, recursive = true) {
    const iter = this.kv.list({ prefix });
    const entries = [];

    for await (const entry of iter) {
      if (!recursive && entry.key.length > prefix.length + 1) {
        continue;
      }

      entries.push({
        key: entry.key.map((k) => this.stringifyKeyPart(k)),
        value: ValueCodec.encode(entry.value),
      });
    }

    return entries;
  }

  /**
   * Imports records from a JSON-serializable array into the database.
   */
  async importFromJson(
    entries: { key: { type: string; value: string }[]; value: RichValue }[],
  ) {
    let importedCount = 0;
    for (const entry of entries) {
      const key = entry.key.map((p) => this.parseKeyPart(p));
      const value = ValueCodec.decode(entry.value);
      await this.kv.set(key, value);
      importedCount++;
    }
    return { ok: true, importedCount };
  }
}
