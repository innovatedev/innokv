import { Database } from "@/kv/models.ts";
import { ApiKvEntry, ApiKvKeyPart, DbNode } from "./types.ts";
import { KeySerialization } from "./KeySerialization.ts";
import { KeyCodec } from "./KeyCodec.ts";

import { RichValue } from "./ValueCodec.ts";

export default class KvAdminClient {
  private baseUri: string;

  constructor(baseUri: string = "/api") {
    this.baseUri = baseUri;
  }

  private async request<T>(
    endpoint: string,
    method: string = "GET",
    body?: Record<string, unknown>,
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    if (body) {
      if (method === "GET") {
        // remove undefined values from body
        Object.keys(body).forEach((key) => {
          if (body[key] === undefined) {
            delete body[key];
          }
        });
        endpoint += "?" +
          new URLSearchParams(body as Record<string, string>).toString();
      } else {
        options.body = JSON.stringify(body);
      }
    }

    const response = await fetch(`${this.baseUri}${endpoint}`, options);
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        // BaseRepository returns { error: "message", details: ... }
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // use raw text if not json
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  public createDatabase(data: Record<string, unknown>): Promise<Database> {
    if (data.sort !== undefined && typeof data.sort === "string") {
      data.sort = parseInt(data.sort as string);
    }
    return this.request("/databases", "POST", data);
  }

  public updateDatabase(data: Record<string, unknown>): Promise<Database> {
    if (data.sort !== undefined && typeof data.sort === "string") {
      data.sort = parseInt(data.sort as string);
    }
    return this.request(`/databases`, "PUT", data);
  }

  public getDatabases(): Promise<{ cursor?: string; data: Database[] }> {
    return this.request("/databases");
  }

  public deleteDatabase(id: string): Promise<unknown> {
    return this.request(`/databases`, "DELETE", { id });
  }

  public getNodes(
    id: string,
    parentPath: ApiKvKeyPart[],
    options: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: Record<string, DbNode>; cursor?: string }> {
    const parentPathStr = KeyCodec.encode(parentPath);
    return this.request(`/database/nodes`, "GET", {
      id,
      parentPath: parentPathStr,
      cursor: options.cursor,
      limit: options.limit?.toString(),
    });
  }

  public getDatabase(
    id: string,
    path?: string,
  ): Promise<Record<string, DbNode>> {
    const parentPath = path ? KeyCodec.decode(path) : [];

    return this.getNodes(id, parentPath, { limit: 1000 }).then((res) =>
      res.items
    );
  }

  public getRecords<T = unknown>(
    id: string,
    pathInfo: ApiKvKeyPart[],
    cursor?: string,
    limit?: number,
    options: { recursive?: boolean } = {},
  ): Promise<{ records: ApiKvEntry<T>[]; cursor: string }> {
    return this.request(`/database/records`, "GET", {
      id,
      pathInfo: KeyCodec.encode(pathInfo),
      cursor,
      limit: limit?.toString(),
      recursive: options.recursive !== undefined
        ? String(options.recursive)
        : undefined,
    });
  }

  public saveRecord(
    id: string,
    key: unknown[],
    value: unknown,
    versionstamp: string | null = null,
    oldKey?: unknown[],
    options: { expiresAt?: number | null; action?: string; amount?: string } =
      {},
  ): Promise<unknown> {
    const wireKey = key.map((k) => this.stringifyKeyPart(k));
    const payload: Record<string, unknown> = {
      id,
      key: wireKey,
      value,
      versionstamp,
      ...options,
    };
    if (oldKey) {
      payload.oldKey = oldKey.map((k: unknown) => this.stringifyKeyPart(k));
    }
    return this.request("/database/records", "POST", payload);
  }

  public deleteRecord(id: string, key: unknown[]): Promise<unknown> {
    const wireKey = key.map((k) => this.stringifyKeyPart(k));
    return this.request("/database/records", "DELETE", { id, key: wireKey });
  }

  public deleteRecords(
    id: string,
    options: {
      keys?: unknown[][];
      all?: boolean;
      pathInfo?: string;
      recursive?: boolean;
    },
  ): Promise<unknown> {
    const payload: Record<string, unknown> = { id, all: options.all };

    if (options.keys) {
      payload.keys = options.keys.map((key) =>
        key.map((k) => this.stringifyKeyPart(k))
      );
    }

    // Allow empty string for root path
    if (options.pathInfo !== undefined) {
      payload.pathInfo = options.pathInfo;
    }

    if (options.recursive !== undefined) {
      payload.recursive = options.recursive;
    }

    return this.request("/database/records", "DELETE", payload);
  }

  public moveRecords(
    id: string,
    oldPath: string | null,
    newPath: string,
    options: {
      recursive?: boolean;
      targetId?: string;
      mode?: "move" | "copy";
      keys?: ApiKvKeyPart[][];
      sourcePath?: string;
    } = {},
  ): Promise<{ ok: boolean; movedCount: number }> {
    return this.request("/database/records", "PATCH", {
      id,
      oldPath: oldPath || undefined,
      newPath,
      recursive: options.recursive ?? true,
      targetId: options.targetId,
      mode: options.mode,
      keys: options.keys,
      sourcePath: options.sourcePath,
    });
  }

  public exportRecords(
    id: string,
    options: {
      pathInfo?: string;
      recursive?: boolean;
      keys?: unknown[][];
      all?: boolean;
    } = {},
  ): Promise<{ key: ApiKvKeyPart[]; value: RichValue }[]> {
    const payload: Record<string, unknown> = {
      id,
      export: "true",
      recursive: options.recursive !== undefined
        ? String(options.recursive)
        : undefined,
      all: options.all !== undefined ? String(options.all) : undefined,
    };

    if (options.pathInfo !== undefined) {
      payload.pathInfo = options.pathInfo;
    }

    if (options.keys) {
      payload.keys = JSON.stringify(
        options.keys.map((key) => key.map((k) => this.stringifyKeyPart(k))),
      );
    }

    return this.request("/database/records", "GET", payload);
  }

  public importRecords(
    id: string,
    entries: { key: ApiKvKeyPart[]; value: RichValue }[],
  ): Promise<{ ok: boolean; importedCount: number }> {
    return this.request("/database/records", "PUT", {
      id,
      entries,
    });
  }

  private stringifyKeyPart(part: unknown): ApiKvKeyPart {
    return KeySerialization.serialize(part);
  }
}
