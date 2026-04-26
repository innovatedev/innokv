import {
  KeyCodec,
  KeySerialization,
  RichValue,
  ValueCodec,
} from "@/codec/mod.ts";
import {
  ApiKvEntry,
  ApiKvKeyPart,
  type DbNode,
  type SearchOptions,
  type SearchResult,
} from "./types.ts";

import { serialize } from "node:v8";
export class KvExplorer {
  constructor(private kv: Deno.Kv) {}
  /**
   * Calculates the approximate size of a value in bytes using V8 serialization.
   */
  public calculateSize(val: unknown): number {
    try {
      return serialize(val).byteLength;
    } catch {
      return 0;
    }
  }
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
  ): Promise<{ records: ApiKvEntry<RichValue>[]; cursor: string }> {
    const limit = options.limit ?? 100;
    const recursive = options.recursive ?? true;
    let start: Deno.KvKey | undefined;
    if (options.cursor) {
      try {
        start = this.parsePath(options.cursor);
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
        nextCursor = KeyCodec.encode(
          next.key.map((p) => this.stringifyKeyPart(p)),
        );
      }
    }
    const apiRecords = records.map((entry) => ({
      ...entry,
      key: entry.key.map((p) => this.stringifyKeyPart(p)),
      value: ValueCodec.encode(entry.value),
      size: this.calculateSize(entry.value),
    }));
    return { records: apiRecords, cursor: nextCursor };
  }
  private stringifyKeyPart(part: Deno.KvKeyPart): ApiKvKeyPart {
    return KeySerialization.serialize(part);
  }
  private parseKeyPart(part: ApiKvKeyPart): Deno.KvKeyPart {
    return KeySerialization.parse(part);
  }
  parsePath(pathInfo: string): Deno.KvKey {
    return KeyCodec.decode(pathInfo).map((p) => this.parseKeyPart(p));
  }
  async deleteRecords(
    prefix: Deno.KvKey,
    recursive = true,
  ): Promise<{ ok: boolean; deletedCount: number }> {
    let deletedCount = 0;
    // Delete the prefix itself if it exists
    if (prefix.length > 0) {
      await this.kv.delete(prefix);
      deletedCount++;
    }
    const iter = this.kv.list({ prefix });
    let atomic = this.kv.atomic();
    let count = 0;
    for await (const entry of iter) {
      if (!recursive && entry.key.length > prefix.length + 1) {
        continue;
      }
      atomic.delete(entry.key);
      count++;
      deletedCount++;
      if (count >= 100) {
        await atomic.commit();
        atomic = this.kv.atomic();
        count = 0;
      }
    }
    if (count > 0) {
      await atomic.commit();
    }
    return { ok: true, deletedCount };
  }
  /**
   * Moves records from one prefix to another.
   * Performs an atomic move (delete + set) for each entry found.
   */
  async moveRecords(
    oldPrefix: Deno.KvKey,
    newPrefix: Deno.KvKey,
    recursive = true,
    targetKv?: Deno.Kv,
    options: { batchSize?: number } = {},
  ): Promise<{ ok: boolean; movedCount: number }> {
    const batchSize = options.batchSize ?? 100;
    let movedCount = 0;
    const destKv = targetKv ?? this.kv;
    const isCrossDb = destKv !== this.kv;
    // Handle the prefix key itself
    if (oldPrefix.length > 0) {
      const rootEntry = await this.kv.get(oldPrefix);
      if (rootEntry.value !== null) {
        if (isCrossDb) {
          await destKv.set(newPrefix, rootEntry.value);
          // Verify write before delete
          const verify = await destKv.get(newPrefix);
          if (verify.versionstamp === null) {
            throw new Error(
              `Failed to verify write for key: ${JSON.stringify(newPrefix)}`,
            );
          }
          await this.kv.delete(oldPrefix);
          movedCount++;
        } else {
          const res = await this.kv.atomic()
            .delete(oldPrefix)
            .set(newPrefix, rootEntry.value)
            .commit();
          if (res.ok) movedCount++;
        }
      }
    }
    const iter = this.kv.list({ prefix: oldPrefix });
    let atomic = this.kv.atomic();
    let count = 0;
    for await (const entry of iter) {
      if (!recursive && entry.key.length > oldPrefix.length + 1) {
        continue;
      }
      const suffix = entry.key.slice(oldPrefix.length);
      const newKey = [...newPrefix, ...suffix];
      if (isCrossDb) {
        await destKv.set(newKey, entry.value);
        // Verify write before delete
        const verify = await destKv.get(newKey);
        if (verify.versionstamp === null) {
          throw new Error(
            `Failed to verify write for key: ${JSON.stringify(newKey)}`,
          );
        }
        await this.kv.delete(entry.key);
        movedCount++;
      } else {
        atomic.delete(entry.key).set(newKey, entry.value);
        count += 2; // 1 delete + 1 set
        movedCount++;
        if (count >= batchSize) {
          const res = await atomic.commit();
          if (!res.ok) {
            throw new Error(
              `Failed to commit atomic batch at ${JSON.stringify(entry.key)}`,
            );
          }
          atomic = this.kv.atomic();
          count = 0;
        }
      }
    }
    if (count > 0 && !isCrossDb) {
      await atomic.commit();
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
    targetKv?: Deno.Kv,
    options: { batchSize?: number } = {},
  ) {
    const batchSize = options.batchSize ?? 100;
    let copiedCount = 0;
    const destKv = targetKv ?? this.kv;
    const isCrossDb = destKv !== this.kv;
    // Handle the prefix key itself
    if (oldPrefix.length > 0) {
      const rootEntry = await this.kv.get(oldPrefix);
      if (rootEntry.value !== null) {
        await destKv.set(newPrefix, rootEntry.value);
        copiedCount++;
      }
    }
    const iter = this.kv.list({ prefix: oldPrefix });
    let atomic = destKv.atomic();
    let count = 0;
    for await (const entry of iter) {
      if (!recursive && entry.key.length > oldPrefix.length + 1) {
        continue;
      }
      const suffix = entry.key.slice(oldPrefix.length);
      const newKey = [...newPrefix, ...suffix];
      if (isCrossDb) {
        await destKv.set(newKey, entry.value);
      } else {
        atomic.set(newKey, entry.value);
        count++;
        if (count >= batchSize) {
          await atomic.commit();
          atomic = destKv.atomic();
          count = 0;
        }
      }
      copiedCount++;
    }
    if (count > 0 && !isCrossDb) {
      await atomic.commit();
    }
    return { ok: true, copiedCount };
  }
  /**
   * Exports records under a prefix to a JSON-serializable array.
   */
  async exportToJson(
    prefix: Deno.KvKey,
    recursive = true,
  ): Promise<ApiKvEntry<RichValue>[]> {
    const iter = this.kv.list({ prefix });
    const entries: ApiKvEntry<RichValue>[] = [];
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
    entries: ApiKvEntry<RichValue>[],
    options: { batchSize?: number } = {},
  ): Promise<{ importedCount: number }> {
    const batchSize = options.batchSize ?? 100;
    let importedCount = 0;
    let atomic = this.kv.atomic();
    let count = 0;
    for (const entry of entries) {
      const key = entry.key.map((p) => this.parseKeyPart(p));
      const value = ValueCodec.decode(entry.value);
      atomic.set(key, value);
      count++;
      importedCount++;
      if (count >= batchSize) {
        const res = await atomic.commit();
        if (!res.ok) {
          throw new Error(
            `Failed to commit atomic import batch at record ${importedCount}`,
          );
        }
        atomic = this.kv.atomic();
        count = 0;
      }
    }
    if (count > 0) {
      const res = await atomic.commit();
      if (!res.ok) {
        throw new Error(`Failed to commit final atomic import batch`);
      }
    }
    return { importedCount };
  }
  /**
   * Searches for keys and values under a prefix.
   */
  async search(
    prefix: Deno.KvKey,
    options: SearchOptions,
  ): Promise<{ results: SearchResult[]; cursor: string }> {
    const limit = options.limit ?? 50;
    const recursive = options.recursive ?? true;
    const regex = options.regex
      ? new RegExp(options.query, options.caseSensitive ? "" : "i")
      : null;
    const queryLower = options.query.toLowerCase();
    let start: Deno.KvKey | undefined;
    if (options.cursor) {
      try {
        start = this.parsePath(options.cursor);
      } catch { /* ignore */ }
    }
    const iter = this.kv.list({ prefix, start }, {
      // We might need to scan more than 'limit' to find enough matches
      // But we don't want to scan forever.
      batchSize: 100,
    });
    const results: SearchResult[] = [];
    let lastKey: Deno.KvKey | undefined;
    let foundCount = 0;
    for await (const entry of iter) {
      lastKey = entry.key;
      if (!recursive && entry.key.length > prefix.length + 1) {
        continue;
      }
      let match: "key" | "value" | null = null;
      // Search Key
      if (options.target === "key" || options.target === "all") {
        const keyStr = KeyCodec.encode(
          entry.key.map((p) => this.stringifyKeyPart(p)),
        );
        if (regex) {
          if (regex.test(keyStr)) match = "key";
        } else if (options.caseSensitive) {
          if (keyStr.includes(options.query)) match = "key";
          else if (this.matchesTyped(options.query, entry.key)) match = "key";
        } else {
          if (keyStr.toLowerCase().includes(queryLower)) match = "key";
          else if (this.matchesTyped(options.query, entry.key)) match = "key";
        }
      }
      // Search Value
      if (!match && (options.target === "value" || options.target === "all")) {
        const valStr = this.stringifyForSearch(entry.value);
        if (regex) {
          if (regex.test(valStr)) match = "value";
        } else if (options.caseSensitive) {
          if (valStr.includes(options.query)) match = "value";
          else if (this.matchesTyped(options.query, entry.value)) {
            match = "value";
          }
        } else {
          if (valStr.toLowerCase().includes(queryLower)) match = "value";
          else if (this.matchesTyped(options.query, entry.value)) {
            match = "value";
          }
        }
      }
      if (match) {
        results.push({
          key: entry.key.map((p) => this.stringifyKeyPart(p)),
          value: ValueCodec.encode(entry.value),
          versionstamp: entry.versionstamp,
          size: this.calculateSize(entry.value),
          matchTarget: match,
        });
        foundCount++;
        if (foundCount >= limit) break;
      }
    }
    let nextCursor = "";
    if (foundCount >= limit && lastKey) {
      nextCursor = KeyCodec.encode(
        lastKey.map((p) => this.stringifyKeyPart(p)),
      );
    }
    return { results, cursor: nextCursor };
  }
  private stringifyForSearch(val: unknown): string {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (val instanceof Uint8Array) return `u8[${val.join(",")}]`;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "bigint") return String(val);
    // Recursively extract values only, stripping metadata
    const extractValues = (v: unknown): unknown => {
      if (v === null || typeof v !== "object") return v;
      if (v instanceof Uint8Array) return Array.from(v);
      if (v instanceof Date) return v.toISOString();
      if (v instanceof Map) {
        return Array.from(v.entries()).map(([mk, mv]) => [
          extractValues(mk),
          extractValues(mv),
        ]);
      }
      if (v instanceof Set) {
        return Array.from(v).map((sv) => extractValues(sv));
      }
      if (Array.isArray(v)) {
        return v.map((av) => extractValues(av));
      }
      // Standard object
      const obj: Record<string, unknown> = {};
      for (const [ok, ov] of Object.entries(v as object)) {
        obj[ok] = extractValues(ov);
      }
      return obj;
    };
    if (typeof val === "object" || Array.isArray(val)) {
      return JSON.stringify(extractValues(val));
    }
    return String(val);
  }
  private matchesTyped(query: string, value: unknown): boolean {
    // Try to match numbers exactly
    const num = Number(query);
    if (query.trim() !== "" && !isNaN(num) && typeof value === "number") {
      return num === value;
    }
    // Try to match booleans exactly
    if (query === "true" && value === true) return true;
    if (query === "false" && value === false) return true;
    // Try to match u8[...] exactly
    if (query.startsWith("u8[") && value instanceof Uint8Array) {
      const content = query.slice(3, -1);
      const bytes = content.split(",").map((n) => parseInt(n.trim())).filter((
        n,
      ) => !isNaN(n));
      if (bytes.length === value.length) {
        return bytes.every((b, i) => b === value[i]);
      }
    }
    return false;
  }
}
