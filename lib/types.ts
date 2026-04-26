import { ApiKvEntry, ApiKvKey, ApiKvKeyPart } from "@/codec/types.ts";

export type { ApiKvEntry, ApiKvKey, ApiKvKeyPart };

export type DbNode = ApiKvKeyPart & {
  children?: Record<string, DbNode>;
  childrenCount?: number;
  hasChildren?: boolean;
  nextCursor?: string;
  lastLoadedCursor?: string;
};

export type SearchOptions = {
  query: string;
  target: "key" | "value" | "all";
  recursive?: boolean;
  regex?: boolean;
  caseSensitive?: boolean;
  limit?: number;
  cursor?: string;
};

export type SearchResult = {
  key: ApiKvKey;
  value: unknown;
  versionstamp: string;
  size?: number;
  expiresAt?: number | null;
  matchTarget: "key" | "value";
};
