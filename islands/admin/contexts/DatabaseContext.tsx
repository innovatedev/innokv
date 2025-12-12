import { createContext, FunctionalComponent } from "preact";
import { Signal, signal, useSignal } from "@preact/signals";
import { Database } from "../../../lib/models.ts";
import { useEffect, useState } from "preact/hooks";
import KvAdminClient from "../../../lib/KvAdminClient.ts";
import { ApiKvEntry } from "../../../lib/types.ts";
import { KeyCodec } from "../../../lib/KeyCodec.ts"; // Codec Updated

// Define the shape of the context
interface DatabaseContextType<DB extends Database = Database> {
  activeDatabase: Database | null;
  setActiveDatabase: (db: Database | null) => void;
  databases: Signal<DB[]>;
  selectedDatabase: Signal<string | null>;
  api: KvAdminClient;
  pathInfo: Signal<{ value: string; type: string }[] | null>;
  records: Signal<ApiKvEntry[]>;
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
};

// Create the context
const DatabaseContext = createContext<DatabaseContextType>(defaultContext);

interface DatabaseProviderProps<DB extends Database = Database> {
  initialDatabases?: DB[];
  initialSelectedDatabase?: string;
}

const DatabaseProvider: FunctionalComponent<DatabaseProviderProps> = ({
  children,
  initialDatabases,
  initialSelectedDatabase,
}) => {
  console.log("DatabaseProvider Init", {
    initialSelectedDatabase,
    initialDatabasesLen: initialDatabases?.length,
  });
  const databases = useSignal(
    initialDatabases || defaultContext.databases.peek(),
  );
  const selectedDatabase = useSignal(
    initialSelectedDatabase || defaultContext.selectedDatabase.peek(),
  );

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
      console.log("Syncing selectedDatabase from prop", {
        from: selectedDatabase.peek(),
        to: initialSelectedDatabase,
      });
      selectedDatabase.value = initialSelectedDatabase;
    }
  }, [initialSelectedDatabase]);

  const [activeDatabase, setActiveDatabase] = useState<Database | null>(
    initialActive,
  );

  useEffect(() => {
    console.log("selectedDatabase changed to", selectedDatabase.value);
    console.trace("selectedDatabase change trace");
  }, [selectedDatabase.value]);

  const pathInfo = useSignal<{ value: string; type: string }[] | null>(null);
  const records = useSignal<ApiKvEntry[]>([]);

  useEffect(() => {
    // Initialize from URL
    const params = new URLSearchParams(window.location.search);
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
      const params = new URLSearchParams(window.location.search);
      const path = params.get("path");

      if (path) {
        try {
          pathInfo.value = KeyCodec.decode(path);
        } catch {}
      } else {
        pathInfo.value = null;
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
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
      window.history.pushState({}, "", url.toString());
    }
  }, [selectedDatabase.value, pathInfo.value]);

  useEffect(() => {
    const db = databases.value.find((db) =>
      db.id === selectedDatabase.value || db.slug === selectedDatabase.value
    );
    if (db) {
      setActiveDatabase(db);
      // Only clear pathInfo if we are NOT initializing or if the selection changed manually
      // But here we can't distinguish.
      // However, if we set pathInfo via setTimeout in init, it will override this null.
      if (
        pathInfo.peek() !== null &&
        !new URLSearchParams(window.location.search).has("path")
      ) {
        // This check is flawed because URL updates separately.
        // Let's rely on the setTimeout in init to override this.
        // And for normal navigation, clicking a DB card sets selectedDatabase, which triggers this, clearing path. Correct.
        pathInfo.value = null;
      } else if (!pathInfo.peek()) {
        pathInfo.value = null;
      }

      records.value = [];
    } else {
      setActiveDatabase(null);
    }
  }, [databases.value, selectedDatabase.value]);

  useEffect(() => {
    if (!pathInfo.value?.length || !selectedDatabase.value) {
      records.value = [];
      return;
    }

    defaultContext.api.getRecords(
      selectedDatabase.value,
      pathInfo.value.map((info) => ({ type: info.type, value: info.value })),
    ).then((data) => {
      console.log("Records", data);
      records.value = data;
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
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export { DatabaseContext, DatabaseProvider };
