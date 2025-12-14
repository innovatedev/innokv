import { type DbNode } from "./types.ts";
import { KeyCodec } from "./KeyCodec.ts";

export class KvExplorer {
  constructor(private kv: Deno.Kv) {}

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
        );
      } catch {
        currentStart = [...prefix];
      }
    } else {
      currentStart = [...prefix];
    }

    // `[...prefix]` sorts before any child.

    let processedCount = 0;
    let nextCursor = "";

    while (processedCount < limit) {
      // Fetch one item to see what the next key is
      // We assume `true` is the highest value in KV sort order used for our data model sentinels.
      // 0: Uint8Array, 1: string, 2: number, 3: bigint, 4: boolean

      // DEBUG:

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

      // Safety check: verify we are still under prefix
      if (key.length <= depth) {
        // This means we matched the prefix itself or something shorter?
        // list({prefix}) should only return keys starting with prefix.
        // If key == prefix, it means the directory has a value. We skip it.
        currentStart = [...prefix, new Uint8Array([0])]; // Move to first possible child
        continue;
      }

      const partVal = key[depth]; // The key part at this level

      // Add to results
      // We need to determine types for DbNode compatibility
      const partInfo = this.stringifyKeyPart(partVal);

      // To strictly follow requirements, set nextStart to skip all keys starting with `[...prefix, partVal]`.
      let hasChildren = key.length > depth + 1;

      // If it looks like a leaf, double-check for children
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

      const nextStart = [...prefix, partVal, true]; // Sentinel to skip descendants

      nodes.push({
        type: partInfo.type,
        value: partInfo.value,
        hasChildren,
        children: {},
      });

      processedCount++;
      currentStart = nextStart;

      // Update cursor for pagination to be the *start* of the next iteration
      nextCursor = KeyCodec.encode(
        currentStart.map((p) => this.stringifyKeyPart(p)),
      );
    }

    return { keys: nodes, cursor: nodes.length >= limit ? nextCursor : "" };
  }

  /**
   * Retrieves records under a prefix.
   *
   * @param prefix Parent key
   * @param options.recursive If true, returns all descendants. If false, only immediate children.
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
      // Filter non-recursive
      if (!recursive) {
        // If key is deeper than prefix + 1, skip it
        if (entry.key.length > prefix.length + 1) {
          continue;
        }
      }
      records.push(entry);
    }

    // Handle pagination
    // Note: If we filtered out items (recursive=false), we might return fewer than limit.
    // This is a known trade-off with post-filtering.
    // Ideally we'd loop until we fill 'limit' or exhaust iterator.

    let nextCursor = "";
    if (records.length > limit) {
      const next = records.pop();
      if (next) {
        nextCursor = JSON.stringify(next.key);
      }
    }

    return { records, cursor: nextCursor };
  }

  // Helper from Database.ts
  // Modified stringify to use KeyCodec flow
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
    } else if (part instanceof Date) {
      return { value: part.toISOString(), type: "Date" };
    } else if (part instanceof Uint8Array) {
      return { value: btoa(String.fromCharCode(...part)), type: "Uint8Array" };
    } else if (Array.isArray(part)) {
      return { value: JSON.stringify(part), type: "Array" };
    } else {
      return { value: String(part), type: "unknown" };
    }
  }

  private parseKeyPart(part: { type: string; value: string }) {
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
}
