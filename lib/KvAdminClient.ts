import { Database } from "./models.ts";
import { ApiKvEntry, DbNode } from "./types.ts";
import { KeyCodec } from "./KeyCodec.ts";

export default class KvAdminClient {
  private baseUri: string;

  constructor(baseUri: string = "/api", private csrfToken: string = "") {
    if (!csrfToken) {
      this.csrfToken =
        globalThis.document?.querySelector('meta[name="csrf-token"]')
          ?.getAttribute("content") || "";
    }
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
        "X-CSRF-Token": this.csrfToken,
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
      throw new Error(errorText);
    }
    return response.json();
  }

  public createDatabase(data: Record<string, unknown>): Promise<Database> {
    console.log("Creating database with data:", data);
    if (data.sort !== undefined && typeof data.sort === "string") {
      data.sort = parseInt(data.sort as string);
    }
    return this.request("/databases", "POST", data);
  }

  public updateDatabase(data: Record<string, unknown>): Promise<unknown> {
    console.log("Updating database with slug:", data.slug, "and data:", data);
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

  public getDatabase(
    id: string,
    path?: string,
  ): Promise<Record<string, DbNode>> {
    return this.request(`/database`, "GET", { id, path });
  }

  public getRecords<T = unknown>(
    id: string,
    pathInfo: { type: string; value: string }[],
  ): Promise<ApiKvEntry<T>[]> {
    return this.request(`/database/records`, "GET", {
      id,
      pathInfo: KeyCodec.encode(pathInfo),
    });
  }

  public saveRecord(
    id: string,
    key: unknown[],
    value: unknown,
    versionstamp: string | null = null,
    oldKey?: unknown[],
  ): Promise<unknown> {
    const wireKey = key.map((k) => this.stringifyKeyPart(k));
    const payload: any = { id, key: wireKey, value, versionstamp };
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
    const payload: any = { id, all: options.all };

    if (options.keys) {
      payload.keys = options.keys.map((key) =>
        key.map((k) => this.stringifyKeyPart(k)) // fixed: double encoding? No, stringifyKeyPart returns {type, value}
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

  private stringifyKeyPart(part: unknown): { type: string; value: string } {
    if (
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      "value" in part
    ) {
      return part as { type: string; value: string };
    }

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
    }

    return { value: String(part), type: "string" };
  }
}
