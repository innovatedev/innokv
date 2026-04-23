import { type DbNode } from "./types.ts";
import { KeyCodec } from "./KeyCodec.ts";

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

    return { records, cursor: nextCursor };
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
    } else if (part instanceof Uint8Array) {
      return { value: btoa(String.fromCharCode(...part)), type: "Uint8Array" };
    } else {
      // deno-lint-ignore no-explicit-any
      const p = part as any;
      if (p instanceof Date) {
        return { value: p.toISOString(), type: "Date" };
      }
      if (Array.isArray(p)) {
        return { value: JSON.stringify(p), type: "Array" };
      }
      return { value: String(part), type: "unknown" };
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
    const iter = this.kv.list({ prefix });
    for await (const entry of iter) {
      if (!recursive && entry.key.length > prefix.length + 1) {
        continue;
      }
      await this.kv.delete(entry.key);
    }
    return { ok: true };
  }
}
