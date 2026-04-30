import { KeyCodec } from "@/codec/mod.ts";
import { useContext, useEffect, useRef } from "preact/hooks";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";
import Dialog from "./Dialog.tsx";
import KvEntryForm from "./forms/KvEntry.tsx";
import { useSignal } from "@preact/signals";
import { ApiKvEntry, ApiKvKeyPart, DbNode } from "@/lib/types.ts";

import ConnectDatabaseForm from "./forms/ConnectDatabase.tsx";
import MoveRecords from "./forms/MoveRecords.tsx";
import Sidebar from "./Sidebar.tsx";
import Toolbar from "./Toolbar.tsx";
import RecordsView from "./RecordsView.tsx";
import { Database } from "@/kv/models.ts";
import { DatabaseStatsView } from "./components/DatabaseStatsView.tsx";

// Hooks
import { useKvSearch } from "./hooks/useKvSearch.ts";
import { useBulkActions } from "./hooks/useBulkActions.ts";
import { useDbStructure } from "./hooks/useDbStructure.ts";
import { ContextMenu, ContextMenuState } from "./components/ContextMenu.tsx";

interface DatabaseViewProps {
  initialStructure?: Record<string, DbNode> | null;
}

export default function DatabaseView({ initialStructure }: DatabaseViewProps) {
  const {
    databases,
    selectedDatabase,
    activeDatabase,
    api,
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
    refreshStats,
    hasPermission: checkPermission,
  } = useContext(DatabaseContext);

  const error = useSignal<string | null>(null);

  // --- Logic Hooks ---
  const {
    dbStructure,
    setDbStructure,
    openPaths,
    mergeStructure,
    togglePath,
  } = useDbStructure(
    activeDatabase,
    api,
    initialStructure,
    pathInfo,
    error,
  );

  const {
    searchQuery,
    isSearchActive,
    searchResults,
    searchLoading,
    searchCursor,
    searchHasMore,
    searchTarget,
    searchRegex,
    searchCaseSensitive,
    handleSearch,
    clearSearch,
  } = useKvSearch();

  const {
    selectedKeys,
    selectAllMatching,
    handleBulkDelete,
    handleExport,
    handleImport,
  } = useBulkActions(
    activeDatabase,
    selectedDatabase,
    api,
    pathInfo,
    records,
    nextCursor,
    cursor,
    limit,
    isSearchActive,
    searchResults,
    handleSearch,
    setDbStructure,
  );

  const createEntryRef = useRef<HTMLDialogElement>(null);
  const createDatabaseRef = useRef<HTMLDialogElement>(null);
  const statsModalRef = useRef<HTMLDialogElement>(null);
  const moveRef = useRef<HTMLDialogElement>(null);
  const movePath = useSignal<ApiKvKeyPart[]>([]);
  const moveKeys = useSignal<ApiKvKeyPart[][] | null>(null);
  const moveMode = useSignal<"move" | "copy">("move");
  const selectedEntry = useSignal<ApiKvEntry | null>(null);
  const editingDatabase = useSignal<Database | null>(null);
  const viewingStatsDatabase = useSignal<Database | null>(null);
  const viewingStatsPath = useSignal<ApiKvKeyPart[] | null>(null);

  useEffect(() => {
    error.value = null;
  }, [selectedDatabase.value]);

  const dbId = activeDatabase?.slug || activeDatabase?.id || "";
  const dbSettings = userSettings.value?.databases?.[dbId] || {};

  const sidebarOpen = useSignal(dbSettings.treeViewOpen ?? true);
  const sidebarWidth = useSignal(dbSettings.treeWidth ?? 256);
  const isResizing = useSignal(false);

  const contextMenu = useSignal<ContextMenuState | null>(null);

  useEffect(() => {
    const closeMenu = () => contextMenu.value = null;
    globalThis.addEventListener("click", closeMenu);
    return () => globalThis.removeEventListener("click", closeMenu);
  }, []);

  const navigateToRoot = () => {
    pathInfo.value = [];
  };

  const currentDbName = activeDatabase
    ? (activeDatabase.name || activeDatabase.id)
    : "Database";

  // Sync signals from user settings when database changes
  useEffect(() => {
    if (!activeDatabase) return;
    const dbId = activeDatabase.slug || activeDatabase.id;
    const current = userSettings.value?.databases?.[dbId] || {};

    // Only update if the signal is different from settings and it's the initial load for this DB
    // Actually, it's better to just force sync once when dbId changes
    sidebarOpen.value = current.treeViewOpen ?? true;
    sidebarWidth.value = current.treeWidth ?? 256;
  }, [activeDatabase?.id, activeDatabase?.slug]);

  // Save signals to user settings when they change
  useEffect(() => {
    if (!activeDatabase) return;
    const dbId = activeDatabase.slug || activeDatabase.id;
    const current = userSettings.value?.databases?.[dbId] || {};

    if (
      current.treeViewOpen !== sidebarOpen.value ||
      current.treeWidth !== sidebarWidth.value
    ) {
      updateSettings({
        databases: {
          [dbId]: {
            ...current,
            treeViewOpen: sidebarOpen.value,
            treeWidth: sidebarWidth.value,
          },
        },
      });
    }
  }, [
    sidebarOpen.value,
    sidebarWidth.value,
    activeDatabase?.id,
    activeDatabase?.slug,
  ]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.value) return;
      sidebarWidth.value = Math.max(150, Math.min(600, e.clientX));
    };
    const handleMouseUp = () => {
      isResizing.value = false;
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isResizing.value) {
      globalThis.addEventListener("mousemove", handleMouseMove);
      globalThis.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing.value]);

  const currentKeyStrings = isSearchActive.value
    ? searchResults.value.map((r) => KeyCodec.encode(r.key))
    : records.value.map((r) => KeyCodec.encode(r.key));

  const allVisibleSelected = currentKeyStrings.length > 0 &&
    currentKeyStrings.every((k) => selectedKeys.value.has(k));

  const toggleSelection = (key: ApiKvKeyPart[]) => {
    const str = KeyCodec.encode(key);
    const newSet = new Set(selectedKeys.value);
    if (newSet.has(str)) newSet.delete(str);
    else newSet.add(str);
    selectedKeys.value = newSet;
    selectAllMatching.value = false;
  };

  const toggleSelectVisible = () => {
    if (allVisibleSelected) {
      selectedKeys.value = new Set();
      selectAllMatching.value = false;
    } else {
      const newS = new Set(selectedKeys.value);
      currentKeyStrings.forEach((k) => newS.add(k));
      selectedKeys.value = newS;
    }
  };

  useEffect(() => {
    selectedKeys.value = new Set();
    selectAllMatching.value = false;
  }, [activeDatabase?.id, pathInfo.value, cursor.value, isSearchActive.value]);

  useEffect(() => {
    if (isSearchActive.value && activeDatabase) {
      handleSearch();
    }
  }, [activeDatabase?.id, pathInfo.value, isSearchActive.value]);

  const toggleExpandAll = () => {
    const next = forceExpandValues.value === true ? false : true;
    forceExpandValues.value = next;
  };

  const handleSwitchDatabase = (id: string) => {
    const db = databases.value.find((d) => d.id === id || d.slug === id);
    const dest = db?.slug || id;
    globalThis.location.href = `/${dest}${globalThis.location.search}`;
  };

  const handleRefresh = async () => {
    const dbId = activeDatabase?.slug || activeDatabase?.id;
    if (!dbId) return;

    try {
      // 1. Refresh records
      const res = await api.getRecords(
        dbId,
        pathInfo.value || [],
        cursor.value,
        limit.value,
        { recursive: false },
      );
      records.value = res.records;
      nextCursor.value = res.cursor;

      // 2. Refresh structure
      const structure = await api.getDatabase(dbId);
      setDbStructure(structure);

      // 3. Refresh database list (for metadata)
      const dbsRes = await api.getDatabases();
      if (dbsRes.data) databases.value = dbsRes.data;
    } catch (err) {
      console.error("Refresh failed:", err);
      error.value = "Refresh failed";
    }
  };

  const handleFolderDelete = async () => {
    if (!activeDatabase || !contextMenu.value) return;
    const targetPath = contextMenu.value.path;

    if (activeDatabase.mode === "r") {
      alert("Database is read-only");
      return;
    }

    if (
      !confirm(
        "Delete all records under this key? This action cannot be undone.",
      )
    ) return;

    try {
      const dbId = activeDatabase.slug || activeDatabase.id;
      await api.deleteRecords(dbId, {
        all: true,
        pathInfo: KeyCodec.encode(targetPath),
      });

      const target = activeDatabase?.slug || selectedDatabase.value;
      if (target) {
        api.getDatabase(target).then((structure) => {
          setDbStructure(structure);
        });
        if (pathInfo.value) {
          const pathStr = KeyCodec.encode(pathInfo.value);
          const deletedStr = KeyCodec.encode(targetPath);
          if (pathStr.startsWith(deletedStr)) {
            pathInfo.value = targetPath.slice(0, -1);
          } else {
            api.getRecords(target, pathInfo.value, cursor.value, limit.value, {
              recursive: false,
            }).then((res) => {
              records.value = res.records;
              nextCursor.value = res.cursor;
            });
          }
        }
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleMove = async (
    newPathStr: string,
    recursive: boolean,
    targetId?: string,
    keys?: ApiKvKeyPart[][],
  ) => {
    if (!activeDatabase || (!movePath.value && !keys)) return;
    const dbId = (activeDatabase.slug || activeDatabase.id) as string;
    const oldPathStr = movePath.value ? KeyCodec.encode(movePath.value) : null;

    try {
      const res = await api.moveRecords(
        dbId,
        oldPathStr,
        newPathStr,
        {
          recursive,
          targetId,
          mode: moveMode.value,
          keys,
          sourcePath: KeyCodec.encode(pathInfo.value || []),
        },
      );
      if (res.ok) {
        if (pathInfo.value) {
          const currentStr = KeyCodec.encode(pathInfo.value);
          if (oldPathStr && currentStr.startsWith(oldPathStr)) {
            pathInfo.value = [];
          } else {
            const target =
              (activeDatabase?.slug || selectedDatabase.value) as string;
            api.getRecords(target, pathInfo.value, cursor.value, limit.value, {
              recursive: false,
            }).then((res) => {
              records.value = res.records;
              nextCursor.value = res.cursor;
            });
          }
        }
        api.getDatabase(dbId).then((s) => setDbStructure(s));
      }
    } catch (err: unknown) {
      alert(`Move failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!activeDatabase) {
    if (databases.value.length > 0 && selectedDatabase.value) {
      return (
        <div class="flex flex-col items-center justify-center h-screen gap-4">
          <h1 class="text-2xl font-bold">Database Not Found</h1>
          <p class="text-base-content/60">
            The database you are looking for does not exist or has been deleted.
          </p>
          <a href="/" class="btn btn-brand">Go Home</a>
        </div>
      );
    }
    return <div class="p-10 text-center">Loading database...</div>;
  }

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

  return (
    <div class="flex h-screen w-full overflow-hidden">
      <style>{styles}</style>

      <Sidebar
        databases={databases.value}
        activeDatabase={activeDatabase}
        dbStructure={dbStructure}
        pathInfo={pathInfo}
        openPaths={openPaths}
        gonePaths={gonePaths.value}
        sidebarOpen={sidebarOpen}
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        onTogglePath={togglePath}
        onNavigateToRoot={navigateToRoot}
        onContextMenu={(e, type, path, dbId) => {
          contextMenu.value = {
            x: e.clientX,
            y: e.clientY,
            type,
            path,
            dbId,
          };
        }}
        onLoadMoreNodes={(path, cursor) => {
          const dbId = activeDatabase?.slug || activeDatabase?.id;
          if (!dbId) return;

          api.getNodes(dbId, path, { cursor }).then((res) => {
            const nodes = res.items;
            if (nodes && Object.keys(nodes).length > 0) {
              setDbStructure((prev) => {
                if (!prev) return nodes;
                return mergeStructure(prev, path, nodes, res.cursor);
              });
            }
          });
        }}
        onRefresh={handleRefresh}
      />

      {/* Database Stats Modal */}
      <Dialog
        ref={statsModalRef}
        title={viewingStatsPath.value && viewingStatsPath.value.length > 0
          ? "Node Statistics"
          : "Database Statistics"}
      >
        {(() => {
          const db = databases.value.find(
            (d) =>
              d.id === viewingStatsDatabase.value?.id ||
              d.slug === viewingStatsDatabase.value?.slug,
          );
          if (!db) return null;

          return (
            <div class="p-1">
              <h3 class="text-lg font-bold mb-4 flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="opacity-50 font-normal">Stats for</span>
                  {db.name}
                </div>
                {viewingStatsPath.value && viewingStatsPath.value.length > 0 &&
                  (
                    <div class="text-xs font-mono opacity-40 break-all bg-base-200 p-2 rounded mt-1">
                      {KeyCodec.encode(viewingStatsPath.value)}
                    </div>
                  )}
              </h3>
              <DatabaseStatsView
                key={`${db.id}-${
                  KeyCodec.encode(viewingStatsPath.value || [])
                }`}
                database={db}
                path={viewingStatsPath.value || undefined}
                onRefreshStats={(dbId, path, data) =>
                  refreshStats(dbId, path, data)}
              />
              <div class="modal-action mt-6">
                <button
                  type="button"
                  class="btn"
                  onClick={() => {
                    statsModalRef.current?.close();
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      <div class="flex-1 flex flex-col h-full min-w-0 bg-base-100">
        <Toolbar
          activeDatabase={activeDatabase}
          databases={databases.value}
          sidebarOpen={sidebarOpen}
          pathInfo={pathInfo}
          dbStructure={dbStructure}
          currentDbName={currentDbName}
          searchQuery={searchQuery}
          isSearchActive={isSearchActive}
          searchTarget={searchTarget}
          searchRegex={searchRegex}
          searchCaseSensitive={searchCaseSensitive}
          onNavigateToRoot={navigateToRoot}
          onSwitchDatabase={handleSwitchDatabase}
          onNewRecord={() => {
            selectedEntry.value = null;
            createEntryRef.current?.showModal();
          }}
          onContextMenu={(e, type, path, dbId) => {
            contextMenu.value = {
              x: e.clientX,
              y: e.clientY,
              type,
              path,
              dbId,
            };
          }}
          onSearch={() => {
            isSearchActive.value = true;
            handleSearch();
          }}
          onClearSearch={clearSearch}
          onBulkDelete={handleBulkDelete}
          onExport={handleExport}
          onImport={handleImport}
          onRefresh={handleRefresh}
          onLoadNodes={(path) => {
            const dbId = activeDatabase?.slug || activeDatabase?.id;
            if (!dbId) return;
            api.getNodes(dbId, path).then((res) => {
              const nodes = res.items;
              if (nodes) {
                setDbStructure((prev) => {
                  if (!prev) return nodes;
                  return mergeStructure(prev, path, nodes, res.cursor);
                });
              }
            });
          }}
        />

        <RecordsView
          isSearchActive={isSearchActive}
          searchResults={searchResults}
          records={records}
          activeDatabase={activeDatabase}
          allVisibleSelected={allVisibleSelected}
          selectedKeys={selectedKeys}
          selectAllMatching={selectAllMatching}
          searchLoading={searchLoading}
          searchHasMore={searchHasMore}
          limit={limit}
          cursorStack={cursorStack}
          cursor={cursor}
          nextCursor={nextCursor}
          pathInfo={pathInfo}
          gonePaths={gonePaths}
          dbStructure={dbStructure}
          databases={databases.value}
          onEditRecord={(record) => {
            selectedEntry.value = record;
            createEntryRef.current?.showModal();
          }}
          onLoadMoreSearch={() => handleSearch(searchCursor.value)}
          onToggleSelection={toggleSelection}
          onToggleExpandAll={toggleExpandAll}
          onToggleSelectVisible={toggleSelectVisible}
          onBulkDelete={handleBulkDelete}
          onBulkMove={() => {
            const keys = Array.from(selectedKeys.value).map((k) =>
              KeyCodec.decode(k)
            );
            moveKeys.value = keys;
            movePath.value = pathInfo.value || [];
            moveMode.value = "move";
            moveRef.current?.showModal();
          }}
          onBulkCopy={() => {
            const keys = Array.from(selectedKeys.value).map((k) =>
              KeyCodec.decode(k)
            );
            moveKeys.value = keys;
            movePath.value = pathInfo.value || [];
            moveMode.value = "copy";
            moveRef.current?.showModal();
          }}
          onExport={handleExport}
        />
      </div>

      {contextMenu.value && (
        <ContextMenu
          state={contextMenu.value}
          activeDatabase={activeDatabase}
          databases={databases.value}
          onViewStats={(dbId, path) => {
            contextMenu.value = null;
            const db = databases.value.find((d) =>
              d.id === dbId || d.slug === dbId
            );
            if (db) {
              viewingStatsDatabase.value = db;
              viewingStatsPath.value = path || null;
              statsModalRef.current?.showModal();
            }
          }}
          onRefresh={handleRefresh}
          onEditDatabase={(dbId) => {
            contextMenu.value = null;
            const db = databases.value.find((d) =>
              d.id === dbId || d.slug === dbId
            );
            if (db && checkPermission("database:manage")) {
              editingDatabase.value = db;
              createDatabaseRef.current?.showModal();
            }
          }}
          onDuplicate={(path) => {
            movePath.value = path;
            moveMode.value = "copy";
            moveRef.current?.showModal();
            contextMenu.value = null;
          }}
          onMove={(path) => {
            movePath.value = path;
            moveMode.value = "move";
            moveRef.current?.showModal();
            contextMenu.value = null;
          }}
          onDeletePath={(_path) => {
            if (confirm("Delete this entire path recursively?")) {
              handleFolderDelete();
              contextMenu.value = null;
            }
          }}
          onRefreshPath={(targetPath) => {
            const dbId = activeDatabase?.slug || activeDatabase?.id;
            contextMenu.value = null;

            if (dbId && targetPath) {
              const currentPathStr = KeyCodec.encode(
                pathInfo.value || [],
              );
              const targetPathStr = KeyCodec.encode(targetPath);

              if (
                currentPathStr === targetPathStr ||
                currentPathStr.startsWith(targetPathStr)
              ) {
                api.getRecords(
                  dbId,
                  pathInfo.value || [],
                  cursor.value,
                  limit.value,
                  { recursive: false },
                ).then((res) => {
                  records.value = res.records;
                  nextCursor.value = res.cursor;
                });
              }

              api.getNodes(dbId, targetPath).then((res) => {
                const nodes = res.items;
                if (nodes) {
                  setDbStructure((prev) => {
                    if (!prev) return nodes;
                    return mergeStructure(
                      prev,
                      targetPath,
                      nodes,
                      res.cursor,
                    );
                  });
                }
              });
            }
          }}
        />
      )}

      {error.value && (
        <div class="toast toast-bottom toast-end z-50">
          <div class="alert alert-error">
            <span>{error.value}</span>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => error.value = null}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Dialog
        ref={createEntryRef}
        title={selectedEntry.value ? "Edit Record" : "Create Record"}
        className="w-11/12 max-w-5xl"
      >
        <KvEntryForm
          entry={selectedEntry.value}
          path={pathInfo.value}
          isReadOnly={activeDatabase?.mode === "r"}
          onCancel={() => createEntryRef.current?.close()}
          onDelete={() => {
            if (!activeDatabase || !selectedEntry.value) return;
            const realKey = KeyCodec.toNative(selectedEntry.value.key);

            api.deleteRecord(
              activeDatabase.slug || activeDatabase.id,
              realKey,
            ).then(() => {
              createEntryRef.current?.close();
              if (pathInfo.value) {
                pathInfo.value = [...pathInfo.value];
              }
              if (activeDatabase) {
                api.getDatabase(
                  activeDatabase.slug || activeDatabase.id,
                )
                  .then((s) => setDbStructure(s));
              }
            }).catch((e: Error | unknown) =>
              alert(e instanceof Error ? e.message : String(e))
            );
          }}
          onSubmit={(data, _form) => {
            if (!activeDatabase) return;
            let oldKey: Deno.KvKeyPart[] | undefined;
            if (selectedEntry.value) {
              oldKey = KeyCodec.toNative(selectedEntry.value.key);
            }
            const key = data.key;
            const versionstamp = selectedEntry.value?.versionstamp || null;

            if (!activeDatabase) return;

            api.saveRecord(
              activeDatabase.slug || activeDatabase.id,
              key,
              data.value,
              versionstamp,
              oldKey,
              { expiresAt: (data as { expiresAt?: number }).expiresAt },
            ).then(() => {
              createEntryRef.current?.close();
              if (pathInfo.value) {
                pathInfo.value = [...pathInfo.value];
              }
              api.getDatabase(
                activeDatabase.slug || activeDatabase.id,
              )
                .then((s) => setDbStructure(s));
            }).catch((e: Error | unknown) =>
              alert(e instanceof Error ? e.message : String(e))
            );
          }}
        />
      </Dialog>

      <Dialog ref={createDatabaseRef} title="Edit Database">
        {(editingDatabase.value || activeDatabase) && (
          <ConnectDatabaseForm
            // The key is essential to force a re-mount when switching database targets,
            // preventing stale form state (like dbType) from persisting between edits.
            key={editingDatabase.value?.id || activeDatabase?.id}
            database={editingDatabase.value || activeDatabase}
            onCancel={() => {
              createDatabaseRef.current?.close();
              editingDatabase.value = null;
            }}
            onDelete={() => {
              const id = editingDatabase.value?.id || activeDatabase?.id;
              if (id) {
                api.deleteDatabase(id)
                  .then(() => {
                    editingDatabase.value = null;
                    globalThis.location.href = "/";
                  })
                  .catch((e) => {
                    alert(`Failed to delete database: ${e.message}`);
                    globalThis.location.href = "/";
                  });
              }
            }}
            onSubmit={(data, _form) => {
              const id = editingDatabase.value?.id || activeDatabase?.id;
              if (id) {
                api.updateDatabase({ id, ...(data as Partial<Database>) })
                  .then((updatedDb: unknown) => {
                    const db = updatedDb as Database;
                    const target = db.slug || db.id;
                    editingDatabase.value = null;
                    globalThis.location.href = `/${target}`;
                  });
              }
            }}
          />
        )}
      </Dialog>
      <MoveRecords
        dialogRef={moveRef}
        currentPath={movePath.value}
        keys={moveKeys.value ?? undefined}
        onMove={handleMove}
        databases={databases.value}
        activeDatabase={activeDatabase}
        mode={moveMode.value}
      />
    </div>
  );
}
