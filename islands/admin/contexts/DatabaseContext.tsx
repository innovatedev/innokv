import { createContext, FunctionalComponent } from "preact";
import { Signal, signal, useSignal } from "@preact/signals";
import { Database, User } from "@/kv/models.ts";
import { useEffect, useRef, useState } from "preact/hooks";
import KvAdminClient from "@/lib/KvAdminClient.ts";
import { ApiKvEntry, ApiKvKeyPart } from "@/lib/types.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { hasPermission } from "@/lib/permissions.ts";

interface DatabaseContextType<DB extends Database = Database> {
  activeDatabase: Database | null;
  setActiveDatabase: (db: Database | null) => void;
  databases: Signal<DB[]>;
  selectedDatabase: Signal<string | null>;
  api: KvAdminClient;
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  records: Signal<ApiKvEntry[]>;
  gonePaths: Signal<Set<string>>;
  userSettings: Signal<User["settings"]>;
  updateSettings: (settings: User["settings"]) => void;
  cursor: Signal<string | undefined>;
  nextCursor: Signal<string | undefined>;
  cursorStack: Signal<Array<string | undefined>>;
  limit: Signal<number>;
  forceExpandValues: Signal<boolean | undefined>;
  // Search state
  searchQuery: Signal<string>;
  isSearchActive: Signal<boolean>;
  searchTarget: Signal<"key" | "value" | "all">;
  searchRegex: Signal<boolean>;
  searchCaseSensitive: Signal<boolean>;
  refreshStats: (
    id: string,
    path?: ApiKvKeyPart[],
    data?: Database["stats"],
  ) => Promise<void>;
  permissions: Signal<string[]>;
  hasPermission: (permission: string) => boolean;
}

const defaultContext: DatabaseContextType = {
  activeDatabase: null,
  setActiveDatabase: () => {},
  databases: signal([]),
  selectedDatabase: signal(null),
  api: new KvAdminClient(),
  pathInfo: signal(null),
  records: signal([]),
  gonePaths: signal(new Set()),
  userSettings: signal({}),
  updateSettings: () => {},
  cursor: signal(undefined),
  nextCursor: signal(undefined),
  cursorStack: signal([]),
  limit: signal(25),
  forceExpandValues: signal(undefined),
  searchQuery: signal(""),
  isSearchActive: signal(false),
  searchTarget: signal("all"),
  searchRegex: signal(false),
  searchCaseSensitive: signal(false),
  refreshStats: async () => {},
  permissions: signal([]),
  hasPermission: () => false,
};

const DatabaseContext = createContext<DatabaseContextType>(defaultContext);

interface DatabaseProviderProps<DB extends Database = Database> {
  initialDatabases?: DB[];
  initialSelectedDatabase?: string;
  initialUserSettings?: User["settings"];
  initialPermissions?: string[];
}

const DatabaseProvider: FunctionalComponent<DatabaseProviderProps> = ({
  children,
  initialDatabases,
  initialSelectedDatabase,
  initialUserSettings,
  initialPermissions,
}) => {
  const databases = useSignal(
    initialDatabases || defaultContext.databases.peek(),
  );
  const permissions = useSignal(
    initialPermissions || defaultContext.permissions.peek(),
  );
  const selectedDatabase = useSignal(
    initialSelectedDatabase || defaultContext.selectedDatabase.peek(),
  );
  const userSettings = useSignal<User["settings"]>(
    initialUserSettings || defaultContext.userSettings.peek() || {},
  );

  const debounceTimer = useRef<number | null>(null);

  const updateSettings = (newSettings: User["settings"]) => {
    if (!newSettings) return;

    // Optimistic update - careful with nested objects
    const current = userSettings.value || {};
    const merged: User["settings"] = { ...current };

    if (newSettings.databases) {
      merged.databases = {
        ...(current.databases || {}),
      };

      for (const [id, settings] of Object.entries(newSettings.databases)) {
        merged.databases[id] = {
          ...(current.databases?.[id] || {}),
          ...settings,
        };
      }
    }

    // Merge other top-level keys
    const { databases: _, ...rest } = newSettings;
    Object.assign(merged, rest);

    userSettings.value = merged;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetch("/api/user/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      }).catch((err) => console.error("Failed to save settings", err));
    }, 1000); // Reduced to 1s
  };

  const initialActive =
    (initialDatabases || defaultContext.databases.peek()).find(
      (d) =>
        d.id ===
          (initialSelectedDatabase || defaultContext.selectedDatabase.peek()) ||
        d.slug ===
          (initialSelectedDatabase || defaultContext.selectedDatabase.peek()),
    ) || null;

  useEffect(() => {
    if (
      initialSelectedDatabase &&
      selectedDatabase.peek() !== initialSelectedDatabase
    ) {
      selectedDatabase.value = initialSelectedDatabase;
    }
  }, [initialSelectedDatabase]);

  const [activeDatabase, setActiveDatabase] = useState<Database | null>(
    initialActive,
  );

  const pathInfo = useSignal<ApiKvKeyPart[] | null>([]);
  const records = useSignal<ApiKvEntry[]>([]);
  const gonePaths = useSignal<Set<string>>(new Set());
  const cursor = useSignal<string | undefined>(undefined);
  const nextCursor = useSignal<string | undefined>(undefined);
  const cursorStack = useSignal<Array<string | undefined>>([]);
  const limit = useSignal<number>(25);
  const forceExpandValues = useSignal<boolean | undefined>(undefined);
  const searchQuery = useSignal("");
  const isSearchActive = useSignal(false);
  const searchTarget = useSignal<"key" | "value" | "all">("all");
  const searchRegex = useSignal(false);
  const searchCaseSensitive = useSignal(false);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const path = params.get("path");
    const q = params.get("q");

    if (path) {
      try {
        pathInfo.value = KeyCodec.decode(path);
      } catch (e) {
        console.error("Failed to parse path from URL", e);
      }
    }

    if (q) {
      searchQuery.value = q;
      isSearchActive.value = true;
      const target = params.get("target");
      if (target === "key" || target === "value" || target === "all") {
        searchTarget.value = target;
      }
      searchRegex.value = params.get("regex") === "true";
      searchCaseSensitive.value = params.get("case") === "true";
    }

    const handlePopState = () => {
      const params = new URLSearchParams(globalThis.location.search);
      const path = params.get("path");
      const q = params.get("q");

      if (path) {
        try {
          pathInfo.value = KeyCodec.decode(path);
        } catch {
          pathInfo.value = [];
        }
      } else {
        pathInfo.value = [];
      }

      if (q) {
        searchQuery.value = q;
        isSearchActive.value = true;
      } else {
        searchQuery.value = "";
        isSearchActive.value = false;
      }
    };
    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, [activeDatabase?.id]);

  useEffect(() => {
    const url = new URL(globalThis.location.href);
    let changed = false;

    // Path
    if (pathInfo.value && pathInfo.value.length > 0) {
      const serialized = KeyCodec.encode(pathInfo.value);
      if (url.searchParams.get("path") !== serialized) {
        url.searchParams.set("path", serialized);
        changed = true;
      }
    } else {
      if (url.searchParams.has("path")) {
        url.searchParams.delete("path");
        changed = true;
      }
    }

    // Search
    if (isSearchActive.value && searchQuery.value) {
      if (url.searchParams.get("q") !== searchQuery.value) {
        url.searchParams.set("q", searchQuery.value);
        changed = true;
      }
      url.searchParams.set("target", searchTarget.value);
      if (searchRegex.value) url.searchParams.set("regex", "true");
      else url.searchParams.delete("regex");
      if (searchCaseSensitive.value) url.searchParams.set("case", "true");
      else url.searchParams.delete("case");
    } else {
      if (url.searchParams.has("q")) {
        url.searchParams.delete("q");
        url.searchParams.delete("target");
        url.searchParams.delete("regex");
        url.searchParams.delete("case");
        changed = true;
      }
    }

    if (changed) {
      globalThis.history.pushState({}, "", url.toString());
    }
  }, [
    pathInfo.value,
    isSearchActive.value,
    searchQuery.value,
    searchTarget.value,
    searchRegex.value,
    searchCaseSensitive.value,
  ]);

  useEffect(() => {
    const db = databases.value.find((db) =>
      db.id === selectedDatabase.value || db.slug === selectedDatabase.value
    );
    if (db) {
      setActiveDatabase(db);
    } else {
      setActiveDatabase(null);
    }
  }, [databases.value, selectedDatabase.value]);

  useEffect(() => {
    if (!pathInfo.value || !selectedDatabase.value) {
      records.value = [];
      return;
    }

    const targetId = activeDatabase?.slug || selectedDatabase.value || "";

    defaultContext.api.getRecords(
      targetId,
      pathInfo.value.map((info) => ({ type: info.type, value: info.value })),
      cursor.value,
      limit.value,
      { recursive: false },
    ).then((data) => {
      records.value = data.records;
      nextCursor.value = data.cursor;

      if (pathInfo.value && pathInfo.value.length > 0) {
        const pathStr = KeyCodec.encode(pathInfo.value);
        if (data.records.length === 0) {
          if (!gonePaths.value.has(pathStr)) {
            gonePaths.value = new Set(gonePaths.value).add(pathStr);
          }
        } else {
          if (gonePaths.value.has(pathStr)) {
            const next = new Set(gonePaths.value);
            next.delete(pathStr);
            gonePaths.value = next;
          }
        }
      }
    }).catch((e) => {
      console.error("Failed to fetch records:", e);
      records.value = [];
      if (pathInfo.value && pathInfo.value.length > 0) {
        pathInfo.value = [];
      }
    });
  }, [pathInfo.value, cursor.value, limit.value, activeDatabase?.id]);

  useEffect(() => {
    cursor.value = undefined;
    nextCursor.value = undefined;
    cursorStack.value = [];
  }, [pathInfo.value, selectedDatabase.value]);

  const refreshStats = async (
    id: string,
    path?: ApiKvKeyPart[],
    data?: Database["stats"],
  ) => {
    try {
      const stats = data ||
        (await defaultContext.api.refreshStats(id, path)).stats;

      if (stats && !path) {
        // Update database in list if it was a root scan
        databases.value = databases.value.map((db) => {
          if (db.id === id || db.slug === id) {
            const updated = { ...db, stats: stats as Database["stats"] };
            if (activeDatabase?.id === db.id) {
              setActiveDatabase(updated);
            }
            return updated;
          }
          return db;
        });
      }
    } catch (e) {
      console.error("Failed to refresh stats:", e);
    }
  };

  return (
    <DatabaseContext.Provider
      value={{
        activeDatabase,
        setActiveDatabase,
        databases,
        selectedDatabase,
        api: defaultContext.api,
        pathInfo,
        records,
        gonePaths,
        userSettings,
        updateSettings,
        cursor,
        nextCursor,
        cursorStack,
        limit,
        forceExpandValues,
        searchQuery,
        isSearchActive,
        searchTarget,
        searchRegex,
        searchCaseSensitive,
        refreshStats,
        permissions,
        hasPermission: (p: string) => hasPermission(permissions.value, p),
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export { DatabaseContext, DatabaseProvider };
