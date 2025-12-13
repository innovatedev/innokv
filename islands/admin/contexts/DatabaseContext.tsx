import { createContext, FunctionalComponent } from "preact";
import { Signal, signal, useSignal } from "@preact/signals";
import { Database, User } from "@/lib/models.ts";
import { useEffect, useRef, useState } from "preact/hooks";
import KvAdminClient from "@/lib/KvAdminClient.ts";
import { ApiKvEntry } from "@/lib/types.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts"; // Codec Updated

// Define the shape of the context
interface DatabaseContextType<DB extends Database = Database> {
  activeDatabase: Database | null;
  setActiveDatabase: (db: Database | null) => void;
  databases: Signal<DB[]>;
  selectedDatabase: Signal<string | null>;
  api: KvAdminClient;
  pathInfo: Signal<{ value: string; type: string }[] | null>;
  records: Signal<ApiKvEntry[]>;
  gonePaths: Signal<Set<string>>;
  userSettings: Signal<User["settings"]>;
  updateSettings: (settings: User["settings"]) => void;
}

// Create default values for the context
const defaultContext: DatabaseContextType = {
  activeDatabase: null,
  setActiveDatabase: () => {
    console.log("Set active database not implemented");
  },
  databases: signal([]),
  selectedDatabase: signal(null),
  api: new KvAdminClient(),
  pathInfo: signal(null),
  records: signal([]),
  gonePaths: signal(new Set()),
  userSettings: signal({}),
  updateSettings: () => {},
};

// Create the context
const DatabaseContext = createContext<DatabaseContextType>(defaultContext);

interface DatabaseProviderProps<DB extends Database = Database> {
  initialDatabases?: DB[];
  initialSelectedDatabase?: string;
  initialUserSettings?: User["settings"];
}

const DatabaseProvider: FunctionalComponent<DatabaseProviderProps> = ({
  children,
  initialDatabases,
  initialSelectedDatabase,
  initialUserSettings,
}) => {
  const databases = useSignal(
    initialDatabases || defaultContext.databases.peek(),
  );
  const selectedDatabase = useSignal(
    initialSelectedDatabase || defaultContext.selectedDatabase.peek(),
  );
  const userSettings = useSignal(
    initialUserSettings || defaultContext.userSettings.peek(),
  );

  const debounceTimer = useRef<number | null>(null);

  const updateSettings = (newSettings: User["settings"]) => {
    // Optimistic update
    userSettings.value = { ...userSettings.value, ...newSettings }; // Simple merge for signal

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetch("/api/user/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "", // CSRF handling might be needed if strictly enforced, checking middleware
        },
        body: JSON.stringify(newSettings),
      }).catch((err) => console.error("Failed to save settings", err));
    }, 3000);
  };

  // Compute initial active database for SSR
  const initialActive =
    (initialDatabases || defaultContext.databases.peek()).find(
      (d) =>
        d.id ===
          (initialSelectedDatabase || defaultContext.selectedDatabase.peek()) ||
        d.slug ===
          (initialSelectedDatabase || defaultContext.selectedDatabase.peek()),
    ) || null;

  // Sync prop changes to signal to handle potentially reused components/islands
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

  const pathInfo = useSignal<{ value: string; type: string }[] | null>(null);
  const records = useSignal<ApiKvEntry[]>([]);
  const gonePaths = useSignal<Set<string>>(new Set());

  useEffect(() => {
    // Initialize from URL
    const params = new URLSearchParams(globalThis.location.search);
    const path = params.get("path");

    if (path) {
      try {
        // slightly delay path setting to allow db change effect to clear it first (hacky but simple)
        setTimeout(() => {
          pathInfo.value = KeyCodec.decode(path);
        }, 0);
      } catch (e) {
        console.error("Failed to parse path from URL", e);
      }
    }

    const handlePopState = () => {
      const params = new URLSearchParams(globalThis.location.search);
      const path = params.get("path");

      if (path) {
        try {
          pathInfo.value = KeyCodec.decode(path);
        } catch {
          // ignore error
        }
      } else {
        pathInfo.value = null;
      }
    };
    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const url = new URL(globalThis.location.href);
    let changed = false;

    // Removed db sync logic as we use routes now

    if (pathInfo.value && pathInfo.value.length > 0) { // Check length to avoid empty path param if KeyCodec returns empty string for empty array? KeyCodec.encode([]) -> "". Check implementation. Array.map.join -> "".
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

    if (changed) {
      globalThis.history.pushState({}, "", url.toString());
    }
  }, [selectedDatabase.value, pathInfo.value]);

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
    if (!pathInfo.value?.length || !selectedDatabase.value) {
      records.value = [];
      return;
    }

    const db = databases.value.find((d) =>
      d.id === selectedDatabase.value || d.slug === selectedDatabase.value
    );
    const targetId = db?.slug || selectedDatabase.value || "";

    defaultContext.api.getRecords(
      targetId,
      pathInfo.value.map((info) => ({ type: info.type, value: info.value })),
    ).then((data) => {
      records.value = data;
      if (pathInfo.value && pathInfo.value.length > 0) {
        const pathStr = KeyCodec.encode(pathInfo.value);
        if (data.length === 0) {
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
    });
  }, [pathInfo.value]);

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
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export { DatabaseContext, DatabaseProvider };
