import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";
import Dialog from "./Dialog.tsx";
import KvEntryForm from "./forms/KvEntry.tsx";
import { Signal, useSignal } from "@preact/signals";
import { ApiKvEntry, ApiKvKeyPart, DbNode } from "@/lib/types.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { Breadcrumbs } from "./Breadcrumbs.tsx";
import { KeyDisplay } from "./KeyDisplay.tsx";
import ConnectDatabaseForm from "./forms/ConnectDatabase.tsx";

// Helper for Node component
interface NodeProps {
  node: DbNode;
  parents?: ApiKvKeyPart[];
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  openPaths: Set<string>;
  onToggle: (pathStr: string) => void;
}

const Node = (
  { node, parents = [], pathInfo, openPaths, onToggle }: NodeProps,
) => {
  const myPath = [...parents, node];
  const myPathStr = KeyCodec.encode(myPath);

  const isActive = pathInfo.value &&
    KeyCodec.encode(pathInfo.value) === myPathStr;
  const isOpen = openPaths.has(myPathStr);

  const hasChildren = node.children && Object.keys(node.children).length > 0;

  if (!hasChildren) return null;

  const hasSubFolders = Object.values(node.children || {}).some((
    child: DbNode,
  ) => child.children && Object.keys(child.children).length > 0);

  const toggleOpen = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(myPathStr);
  };

  const selectNode = (e: Event) => {
    e.preventDefault();
    if (isActive) {
      onToggle(myPathStr);
    } else {
      pathInfo.value = myPath;
    }
  };

  return (
    <li>
      <details open={isOpen}>
        <summary
          class={`w-full group flex items-center gap-2 py-0.5 px-1 rounded cursor-pointer list-none ${
            isActive
              ? "bg-neutral text-neutral-content font-bold hover:bg-neutral"
              : "hover:bg-base-300"
          }`}
          onClick={selectNode}
        >
          {hasSubFolders && (
            <span
              class={`w-4 h-4 flex items-center justify-center p-0 rounded hover:bg-base-300/50`}
              onClick={toggleOpen}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2.5"
                stroke="currentColor"
                class={`w-3 h-3 transition-transform duration-200 ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </span>
          )}

          <div class="flex-1 truncate">
            <KeyDisplay type={node.type} value={node.value} />
          </div>
        </summary>
        <ul>
          {hasChildren &&
            Object.values(node.children || {}).map((child: DbNode) => (
              <Node
                key={child.value}
                node={child}
                parents={myPath}
                pathInfo={pathInfo}
                openPaths={openPaths}
                onToggle={onToggle}
              />
            ))}
        </ul>
      </details>
    </li>
  );
};

interface DatabaseViewProps {
  initialStructure?: Record<string, any> | null;
}

export default function DatabaseView({ initialStructure }: DatabaseViewProps) {
  const {
    databases,
    selectedDatabase,
    activeDatabase,
    api,
    pathInfo,
    records,
  } = useContext(DatabaseContext);
  const [dbStructure, setDbStructure] = useState<Record<string, DbNode> | null>(
    initialStructure || null,
  );

  const createEntryRef = useRef<HTMLDialogElement>(null);
  const createDatabaseRef = useRef<HTMLDialogElement>(null);
  const selectedEntry = useSignal<ApiKvEntry | null>(null);
  const sidebarOpen = useSignal(true);
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());

  // Derived DB Name
  const currentDbName = activeDatabase
    ? (activeDatabase.name || activeDatabase.id)
    : "Database";
  const isRoot = !pathInfo.value || pathInfo.value.length === 0;

  // Sync initial structure if changed
  useEffect(() => {
    if (initialStructure) {
      setDbStructure(initialStructure);
    }
  }, [initialStructure]);

  // If no initial structure, or if DB changes client-side, fetch it.
  useEffect(() => {
    if (!selectedDatabase.value) return;

    // Only fetch if we don't have it or if it might be stale (simple check: if IDs match)
    // But structure isn't keyed by ID here, it's just state.
    // If we switched DBs, we should ideally clear structure or fetch new.
    // For now, let's just fetch if we are client-side only navigation or if we want refresh.
    // NOTE: If provided structure fits current DB, we use it. If not, fetch.

    // Actually simplicity: If initialStructure is provided, use it. But real-time updates?
    const target = activeDatabase?.slug || selectedDatabase.value;
    if (target) {
      api.getDatabase(target).then((structure) => {
        setDbStructure(structure);
      });
    }
  }, [selectedDatabase.value]);

  useEffect(() => {
    if (pathInfo.value) {
      setOpenPaths((prev) => {
        const next = new Set(prev);
        let currentPath: ApiKvKeyPart[] = [];
        let changed = false;
        for (const part of pathInfo.value!) {
          currentPath = [...currentPath, part];
          const str = KeyCodec.encode(currentPath);
          if (!next.has(str)) {
            next.add(str);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [pathInfo.value]);

  // CSS injection for tree view
  const styles = `
      .custom-breadcrumbs { overflow: visible !important; }
      .custom-breadcrumbs > ul { flex-wrap: wrap; }
      .custom-breadcrumbs > ul > li + li::before { display: none !important; content: "" !important; }
      summary::-webkit-details-marker, summary::after { display: none !important; }
      .menu > li.db-root-item > details > ul:before { display: none !important; content: none !important; }
      .menu > li.db-root-item > details > ul { border-left: none !important; margin-left: 0 !important; padding-left: 0 !important; }
      .menu li ul { margin-left: 0.75rem !important; padding-left: 0.25rem !important; border-left: 1px solid var(--fallback-bc,oklch(var(--bc)/0.1)); }
      .menu summary { gap: 0.25rem !important; }
  `;

  const togglePath = (pathStr: string) => {
    setOpenPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pathStr)) newSet.delete(pathStr);
      else newSet.add(pathStr);
      return newSet;
    });
  };

  const navigateToRoot = () => {
    pathInfo.value = [];
  };

  if (!activeDatabase) {
    // Show loading or fallback?
    // SSR should provide activeDatabase via context if ID matches.
    return <div class="p-10 text-center">Loading database...</div>;
  }

  return (
    <div class="flex grow w-full">
      <style>{styles}</style>

      {/* Sidebar */}
      <div
        class={`h-full bg-base-200 overflow-auto transition-all duration-300 ease-in-out ${
          sidebarOpen.value
            ? "w-64 min-w-64 border-r border-base-300"
            : "w-0 min-w-0 overflow-hidden"
        }`}
      >
        <ul class="menu h-full w-full p-0 block">
          <li class="border-b border-neutral-600 flex flex-row items-center p-1! gap-1">
            <a
              href="/"
              class="flex-1 group flex items-center gap-2 rounded hover:bg-base-300 cursor-pointer list-none font-bold"
            >
              <span
                class="truncate"
                style={{
                  fontFamily: '"Press Start 2P"',
                  color: "#F4892D",
                  fontSize: "0.8rem",
                }}
              >
                InnoKV
              </span>
            </a>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square"
              onClick={() => sidebarOpen.value = false}
              title="Close Sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-4 h-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          </li>
          {databases.value.map((db) => {
            const isActive = activeDatabase?.id === db.id;

            if (!isActive) {
              return (
                <li key={db.id}>
                  <a
                    href={`/${db.slug || db.id}`}
                    class="w-full group flex items-center gap-2 p-1 rounded cursor-pointer list-none hover:bg-base-300"
                  >
                    <span class="w-4 h-4 flex items-center justify-center shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-4 h-4 opacity-50"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694-4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                        />
                      </svg>
                    </span>
                    <span class="flex-1 truncate opacity-70">
                      {db.name || db.id}
                    </span>
                  </a>
                </li>
              );
            }

            return (
              <li key={db.id} class="db-root-item">
                <details open class="group">
                  <summary
                    class="w-full group flex items-center gap-2 p-1 rounded cursor-pointer list-none bg-neutral text-neutral-content font-bold hover:bg-neutral"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToRoot();
                    }}
                  >
                    <span class="w-4 h-4 flex items-center justify-center shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-4 h-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M5 12h14M5 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M5 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2"
                        />
                      </svg>
                    </span>
                    <span class="flex-1 truncate">{db.name || db.id}</span>
                  </summary>
                  {dbStructure && (
                    <ul>
                      {Object.entries(dbStructure).map(([key, node]) => (
                        <Node
                          node={node}
                          key={key}
                          pathInfo={pathInfo}
                          openPaths={openPaths}
                          onToggle={togglePath}
                        />
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Main Content */}
      <div class="grow px-4 overflow-visible">
        <div class="flex justify-between items-center py-1">
          <div class="flex items-center gap-0.5">
            {!sidebarOpen.value && (
              <>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs btn-square shrink-0"
                  onClick={() => sidebarOpen.value = true}
                  title="Open Sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>
                <a
                  href="/"
                  class="btn btn-ghost btn-xs normal-case font-bold px-2 shrink-0"
                  title="Home"
                  style={{
                    fontFamily: '"Press Start 2P"',
                    color: "#F4892D",
                    fontSize: "0.8rem",
                  }}
                >
                  InnoKV
                </a>
              </>
            )}
            <Breadcrumbs
              pathInfo={pathInfo}
              dbStructure={dbStructure}
              currentDbName={currentDbName}
              navigateToRoot={navigateToRoot}
              databases={databases.value}
              onSwitchDatabase={(id) => {
                const db = databases.value.find((d) => d.id === id);
                const dest = db?.slug || id;
                globalThis.location.href = `/${dest}`;
              }}
            />
          </div>
          <button
            class="btn btn-sm btn-primary shrink-0"
            type="button"
            onClick={() => {
              selectedEntry.value = null;
              createEntryRef.current?.showModal();
            }}
          >
            +
          </button>
        </div>

        <Dialog
          title={selectedEntry.value ? "Edit Entry" : "Create Entry"}
          ref={createEntryRef}
        >
          <KvEntryForm
            entry={selectedEntry.value}
            path={pathInfo.value}
            onCancel={() => createEntryRef.current?.close()}
            onDelete={() => {
              if (!activeDatabase || !selectedEntry.value) return;
              // ... simplify key conversion logic or move to util ...
              const convertValue = (p: any) => {
                const t = p.type.toLowerCase();
                if (t === "number") return parseFloat(p.value);
                if (t === "boolean") return p.value === "true";
                if (t === "bigint") return BigInt(p.value);
                if (t === "uint8array") {
                  return Uint8Array.from(atob(p.value), (c) => c.charCodeAt(0));
                }
                return p.value;
              };
              const realKey = selectedEntry.value.key.map(convertValue);

              api.deleteRecord(
                activeDatabase.slug || activeDatabase.id,
                realKey,
              ).then(() => {
                createEntryRef.current?.close();
                if (pathInfo.value) pathInfo.value = [...pathInfo.value];
                api.getDatabase(activeDatabase.slug || activeDatabase.id).then((
                  s,
                ) => setDbStructure(s));
              }).catch((e: any) => alert(e.message));
            }}
            onSubmit={(data, form) => {
              if (!activeDatabase) return;
              const convertValue = (p: any) => {
                const t = p.type.toLowerCase();
                if (t === "number") return parseFloat(p.value);
                if (t === "boolean") return p.value === "true";
                if (t === "bigint") return BigInt(p.value);
                if (t === "uint8array") {
                  return Uint8Array.from(
                    atob(p.value),
                    (c) => c.charCodeAt(0),
                  );
                }
                return p.value;
              };
              let oldKey: any[] | undefined;
              if (selectedEntry.value) {
                oldKey = selectedEntry.value.key.map(
                  convertValue,
                );
              }
              const versionstamp = selectedEntry.value?.versionstamp || null;

              api.saveRecord(
                activeDatabase.slug || activeDatabase.id,
                data.key,
                data.value,
                versionstamp,
                oldKey,
              ).then(() => {
                createEntryRef.current?.close();
                if (pathInfo.value) pathInfo.value = [...pathInfo.value];
                api.getDatabase(activeDatabase.slug || activeDatabase.id).then((
                  s,
                ) => setDbStructure(s));
              }).catch((e: any) => alert(e.message));
            }}
          />
        </Dialog>

        <div>
          {isRoot && activeDatabase && (
            <div class="p-4 mb-4 bg-base-100 rounded border border-base-300 relative group">
              <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  class="btn btn-sm btn-ghost"
                  onClick={() => createDatabaseRef.current?.showModal()}
                >
                  Edit
                </button>
              </div>
              <h3 class="font-bold text-lg mb-2">Database Settings</h3>
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm max-w-md">
                <span class="font-semibold text-base-content/70">Name</span>
                {" "}
                <span>{activeDatabase.name}</span>
                <span class="font-semibold text-base-content/70">Type</span>
                {" "}
                <span>{activeDatabase.type}</span>
                {activeDatabase.path && (
                  <>
                    <span class="font-semibold text-base-content/70">Path</span>
                    {" "}
                    <span class="font-mono">{activeDatabase.path}</span>
                  </>
                )}
                <span class="font-semibold text-base-content/70">ID</span>{" "}
                <span class="font-mono text-xs">{activeDatabase.id}</span>
              </div>

              <Dialog ref={createDatabaseRef} title="Edit Database">
                <ConnectDatabaseForm
                  database={activeDatabase}
                  onCancel={() => createDatabaseRef.current?.close()}
                  onDelete={() => {
                    const id = activeDatabase.id;
                    api.deleteDatabase(id)
                      .then(() => {
                        globalThis.location.href = "/";
                      });
                  }}
                  onSubmit={(data, _form) => {
                    api.updateDatabase({ id: activeDatabase.id, ...data })
                      .then((_db) => { // Fixed unused variable
                        globalThis.location.reload();
                      });
                  }}
                />
              </Dialog>
            </div>
          )}
          {!isRoot && (records.value.length
            ? (
              <div class="join join-vertical w-full">
                {records.value.map((record, i) => {
                  return (
                    <details
                      open={i == 0}
                      class="collapse collapse-plus join-item bg-base-100 border-base-300 border"
                      key={record.key}
                    >
                      <summary class="collapse-title font-semibold">
                        <div class="flex gap-2 items-start">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-xs mt-2"
                          />
                          <div class="text-xl">
                            {record.key[record.key.length - 1].value}
                            <div class="text-sm text-neutral-content">
                              {record.versionstamp}
                            </div>
                          </div>
                          <button
                            class="btn btn-sm btn-primary"
                            type="button"
                            onClick={() => {
                              selectedEntry.value = record;
                              createEntryRef.current?.showModal();
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </summary>
                      <div class="collapse-content text-sm">
                        <pre>{JSON.stringify(record.value, null, 2)}</pre>
                      </div>
                    </details>
                  );
                })}
              </div>
            )
            : (
              <div class="p-4">
                <p class="text-sm">No records found</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
