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
  hasChildren?: boolean;
};
