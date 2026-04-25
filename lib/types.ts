export type ApiKvKeyPart = {
  type: string;
  value: string;
};

export type ApiKvKey = ApiKvKeyPart[];
export type ApiKvEntry<T = unknown> = {
  key: ApiKvKey;
  value: T;
  versionstamp: string;
};

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
  matchTarget: "key" | "value";
};
