import {
  DatabaseIcon,
  FileDatabaseIcon,
  MemoryDatabaseIcon,
  RemoteDatabaseIcon,
} from "../../components/icons/DatabaseIcons.tsx";
import { Database } from "@/lib/models.ts";
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
import { RecordItem } from "./RecordItem.tsx";

// Helper for Node component
interface NodeProps {
  node: DbNode;
  parents?: ApiKvKeyPart[];
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  openPaths: Set<string>;
  gonePaths: Set<string>;
  prettyPrintDates: boolean;
  onToggle: (
    path: ApiKvKeyPart[],
    isOpen: boolean,
    hasChildren: boolean,
  ) => void;
  onContextMenu: (e: MouseEvent, path: ApiKvKeyPart[]) => void;
  onLoadMore: (path: ApiKvKeyPart[], cursor: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: "folder" | "item" | "database";
  path: ApiKvKeyPart[];
  dbId?: string;
}

const Node = (
  {
    node,
    parents = [],
    pathInfo,
    openPaths,
    gonePaths,
    prettyPrintDates,
    onToggle,
    onContextMenu,
    onLoadMore,
  }: NodeProps,
) => {
  const myPath = [...parents, node];
  const myPathStr = KeyCodec.encode(myPath);

  const isActive = pathInfo.value &&
    KeyCodec.encode(pathInfo.value) === myPathStr;
  const isOpen = openPaths.has(myPathStr);
  const isGone = gonePaths.has(myPathStr);

  const hasChildren = node.hasChildren ||
    (node.children && Object.keys(node.children).length > 0);

  if (!hasChildren) return null;

  // Smart Arrow Logic:
  // If children are loaded, only show arrow if there is at least one sub-folder (visible child).
  // If children are NOT loaded, assume yes (optimistic) if hasChildren is true.
  const childrenLoaded = node.children && Object.keys(node.children).length > 0;
  const hasVisibleChildren = childrenLoaded
    ? Object.values(node.children!).some((child: DbNode) => child.hasChildren)
    : hasChildren;

  const hasSubFolders = hasVisibleChildren;

  const toggleOpen = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(myPath, !isOpen, !!hasChildren);
  };

  const selectNode = (e: Event) => {
    e.preventDefault();
    if (isActive) {
      onToggle(myPath, !isOpen, !!hasChildren);
    } else {
      pathInfo.value = myPath;
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, myPath);
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
          onContextMenu={handleContextMenu}
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

          <div
            class={`flex-1 truncate ${
              isGone && !hasChildren
                ? "line-through opacity-50 decoration-2"
                : ""
            }`}
          >
            <KeyDisplay
              type={node.type}
              value={node.value}
              prettyPrint={prettyPrintDates}
            />
          </div>
        </summary>
        <ul>
          {hasChildren &&
            Object.values(node.children || {})
              .filter((child: DbNode) => child.hasChildren ||
                (child.children && Object.keys(child.children).length > 0)
              )
              .map((child: DbNode) => (
                <Node
                  key={child.value}
                  node={child}
                  parents={myPath}
                  pathInfo={pathInfo}
                  openPaths={openPaths}
                  gonePaths={gonePaths}
                  prettyPrintDates={prettyPrintDates}
                  onToggle={onToggle}
                  onContextMenu={onContextMenu}
                  onLoadMore={onLoadMore}
                />
              ))}
          {node.nextCursor && (
            <li class="pl-2 py-1">
              <button
                class="btn btn-xs btn-ghost text-xs w-full text-left font-normal opacity-50 hover:opacity-100 flex gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  onLoadMore(myPath, node.nextCursor!); // myPath is the path TO this node. nextCursor fetches more children OF this node.
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-3 h-3"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
                Load more...
              </button>
            </li>
          )}
        </ul>
      </details>
    </li>
  );
};

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
  } = useContext(DatabaseContext);
  // Robust initialization: Handle Record input for initialStructure
  const [dbStructure, setDbStructure] = useState<Record<string, DbNode> | null>(
    () => {
      if (!initialStructure) return null;
      return initialStructure;
    },
  );

  const createEntryRef = useRef<HTMLDialogElement>(null);
  const createDatabaseRef = useRef<HTMLDialogElement>(null);
  const selectedEntry = useSignal<ApiKvEntry | null>(null);
  const editingDatabase = useSignal<Database | null>(null);

  // Pagination State (Moved to Context)

  // Settings: Width & Open State
  const dbId = activeDatabase?.slug || activeDatabase?.id || "";
  const dbSettings = userSettings.value?.databases?.[dbId] || {};

  const sidebarOpen = useSignal(dbSettings.treeViewOpen ?? true);
  const sidebarWidth = useSignal(dbSettings.treeWidth ?? 256);
  const isResizing = useSignal(false);
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());

  // Context Menu State
  const contextMenu = useSignal<ContextMenuState | null>(null);

  useEffect(() => {
    const closeMenu = () => contextMenu.value = null;
    globalThis.addEventListener("click", closeMenu);
    return () => globalThis.removeEventListener("click", closeMenu);
  }, []);

  // Deep Linking / Auto-Expand Effect
  useEffect(() => {
    if (!pathInfo.value || !dbStructure || !activeDatabase) return;

    const path = pathInfo.value;
    const dbId = activeDatabase.slug || activeDatabase.id;

    // 1. Calculate all parent paths that should be open
    const newOpenPaths = new Set(openPaths);
    let changedOpen = false;
    const parents: ApiKvKeyPart[] = [];

    // We iterate the path parts to build up the tree
    // e.g. path = [a, b, c]
    // We need to ensure [a] is open, [a, b] is open.
    // And we need to ensure their children are loaded.

    for (let i = 0; i < path.length; i++) {
      const seg = path[i];
      parents.push(seg);
      const parentStr = KeyCodec.encode(parents);

      if (i < path.length - 1) {
        if (!newOpenPaths.has(parentStr)) {
          newOpenPaths.add(parentStr);
          changedOpen = true;
        }
      }
    }

    if (changedOpen) {
      setOpenPaths(newOpenPaths);
    }

    const checkAndLoad = async () => {
      let currentLevel = dbStructure;
      const currentPath: ApiKvKeyPart[] = [];

      for (let i = 0; i < path.length; i++) {
        const seg = path[i];
        const keyStr = KeyCodec.encode([seg]);
        const node = currentLevel[keyStr];

        if (!node) {
          await api.getNodes(dbId, currentPath).then((res) => {
            const nodes = res.items;
            if (nodes) {
              setDbStructure((prev) => {
                if (!prev) return nodes;
                return mergeStructure(prev, currentPath, nodes, res.cursor);
              });
            }
          });
          return;
        }

        if (i < path.length) {
          if (
            node.hasChildren &&
            (!node.children || Object.keys(node.children).length === 0)
          ) {
            const nextPath = [...currentPath, seg];
            await api.getNodes(dbId, nextPath).then((res) => {
              const nodes = res.items;
              if (nodes) {
                setDbStructure((prev) => {
                  if (!prev) return nodes;
                  return mergeStructure(prev, nextPath, nodes, res.cursor);
                });
              }
            });
            return;
          }
        }

        currentLevel = node.children || {};
        currentPath.push(seg);
      }
    };

    checkAndLoad();
  }, [pathInfo.value, dbStructure, activeDatabase]);

  // Selection State
  const selectedKeys = useSignal<Set<string>>(new Set());
  const selectAllMatching = useSignal(false);

  // Computed selection state
  const currentKeyStrings = records.value.map((r) => KeyCodec.encode(r.key));
  const allVisibleSelected = currentKeyStrings.length > 0 &&
    currentKeyStrings.every((k) => selectedKeys.value.has(k));
  const selectionCount = selectAllMatching.value
    ? "All"
    : selectedKeys.value.size;

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

  const handleBulkDelete = async () => {
    if (
      !activeDatabase || (!selectedKeys.value.size && !selectAllMatching.value)
    ) return;

    if (activeDatabase.mode === "r") {
      alert("Database is read-only");
      return;
    }

    const isAll = selectAllMatching.value;
    const msg = isAll
      ? "Delete all records at this level?"
      : `Are you sure you want to delete ${selectionCount} records? This cannot be undone.`;

    if (!confirm(msg)) return;

    try {
      const dbId = activeDatabase.slug || activeDatabase.id;
      // If selectAllMatching, we send all=true and pathInfo
      if (selectAllMatching.value) {
        await api.deleteRecords(dbId, {
          all: true,
          pathInfo: KeyCodec.encode(pathInfo.value || []),
          recursive: false, // Explicitly shallow delete for list view
        });
      } else {
        // Decode keys
        const keys = Array.from(selectedKeys.value).map((k) =>
          KeyCodec.decode(k)
        );
        await api.deleteRecords(dbId, { keys });
      }

      // Refresh
      selectedKeys.value = new Set();
      selectAllMatching.value = false;
      const target = activeDatabase?.slug || selectedDatabase.value;
      if (target && pathInfo.value) {
        // refresh records
        api.getRecords(target, pathInfo.value, cursor.value, limit.value, {
          recursive: false,
        }).then(
          (res) => {
            records.value = res.records;
            nextCursor.value = res.cursor;
            if (res.records.length === 0 && pathInfo.value!.length > 0) {
              const pathStr = KeyCodec.encode(pathInfo.value!);
              if (!gonePaths.value.has(pathStr)) {
                gonePaths.value = new Set(gonePaths.value).add(pathStr);
              }
            }
          },
        );
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const _handleRefresh = () => {
    if (!activeDatabase) return;
    const dbId = activeDatabase.slug || activeDatabase.id;

    // Refresh structure
    api.getDatabase(dbId).then((s) => setDbStructure(s));

    // If current path starts with context path or is equal, refresh records
    if (pathInfo.value && contextMenu.value) {
      const currentStr = KeyCodec.encode(pathInfo.value);
      const ctxStr = KeyCodec.encode(contextMenu.value.path);

      if (currentStr.startsWith(ctxStr)) {
        api.getRecords(dbId, pathInfo.value, cursor.value, limit.value, {
          recursive: false,
        }).then(
          (res) => {
            records.value = res.records;
            nextCursor.value = res.cursor;
            if (res.records.length === 0 && pathInfo.value!.length > 0) {
              const pathStr = KeyCodec.encode(pathInfo.value!);
              if (!gonePaths.value.has(pathStr)) {
                gonePaths.value = new Set(gonePaths.value).add(pathStr);
              }
            }
          },
        );
      }
    }

    contextMenu.value = null;
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

      // Refresh structure
      const target = activeDatabase?.slug || selectedDatabase.value;
      if (target) {
        api.getDatabase(target).then((structure) => {
          setDbStructure(structure);
        });
        // If current view was inside this folder, go up? Or just refresh.
        if (pathInfo.value) {
          // If path starts with deleted path
          const pathStr = KeyCodec.encode(pathInfo.value);
          const deletedStr = KeyCodec.encode(targetPath);
          if (pathStr.startsWith(deletedStr)) {
            // Go to parent of deleted folder
            pathInfo.value = targetPath.slice(0, -1);
          } else {
            // refresh current view
            api.getRecords(target, pathInfo.value, cursor.value, limit.value, {
              recursive: false,
            })
              .then((res) => {
                records.value = res.records;
                nextCursor.value = res.cursor;
              });
          }
        }
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Derived DB Name
  const currentDbName = activeDatabase
    ? (activeDatabase.name || activeDatabase.id)
    : "Database";
  const _isRoot = pathInfo.value === null || pathInfo.value.length === 0;

  // Persist Sidebar State
  useEffect(() => {
    if (!activeDatabase) return;
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
  }, [sidebarOpen.value, sidebarWidth.value]);

  // Resize Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.value) return;
      // Min width 150, Max width 600
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

  // Sync initial structure if changed
  useEffect(() => {
    if (initialStructure) {
      setDbStructure(initialStructure);
    }
  }, [initialStructure]);

  // If no initial structure, or if DB changes client-side, fetch it.
  useEffect(() => {
    if (!selectedDatabase.value) return;

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

  // Clear selection on path change (Pagination reset in Context)
  useEffect(() => {
    selectedKeys.value = new Set();
    selectAllMatching.value = false;
  }, [pathInfo.value, selectedDatabase.value]);

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

  const mergeStructure = (
    currentStruct: Record<string, DbNode>,
    path: ApiKvKeyPart[],
    newChildren: Record<string, DbNode>,
    nextCursor?: string,
  ): Record<string, DbNode> => {
    // Helper to merge a dictionary of nodes while preserving children of existing nodes
    const safeMergeDict = (
      current: Record<string, DbNode>,
      incoming: Record<string, DbNode>,
    ): Record<string, DbNode> => {
      const merged = { ...current };
      for (const [key, newNode] of Object.entries(incoming)) {
        if (merged[key]) {
          // Node exists: Update props but preserve children/cursors from existing state
          // We assume local state (open folders) is more valuable than fresh server state for these props
          merged[key] = {
            ...newNode,
            children: merged[key].children,
            nextCursor: merged[key].nextCursor,
            lastLoadedCursor: merged[key].lastLoadedCursor,
          };
        } else {
          merged[key] = newNode;
        }
      }
      return merged;
    };

    if (path.length === 0) {
      return safeMergeDict(currentStruct, newChildren);
    }

    const [head, ...tail] = path;
    const headKey = KeyCodec.encode([head]);
    const node = currentStruct[headKey];

    if (!node) {
      return currentStruct;
    }

    if (tail.length === 0) {
      // We found the parent node (head). Update its children and nextCursor.
      const existingChildren = node.children || {};
      const mergedChildren = safeMergeDict(existingChildren, newChildren);

      return {
        ...currentStruct,
        [headKey]: {
          ...node,
          children: mergedChildren,
          childrenCount: Object.keys(mergedChildren).length,
          lastLoadedCursor: nextCursor !== undefined
            ? nextCursor
            : node.lastLoadedCursor,
          nextCursor: nextCursor !== undefined ? nextCursor : node.nextCursor,
        },
      };
    }

    return {
      ...currentStruct,
      [headKey]: {
        ...node,
        children: mergeStructure(
          node.children || {},
          tail,
          newChildren,
          nextCursor,
        ),
      },
    };
  };

  const togglePath = (
    path: ApiKvKeyPart[],
    _isOpen: boolean,
    hasChildren: boolean,
  ) => {
    const pathStr = KeyCodec.encode(path);
    const currentlyOpen = openPaths.has(pathStr);

    // Toggle state
    setOpenPaths((prev) => {
      const newSet = new Set(prev);
      if (currentlyOpen) newSet.delete(pathStr);
      else newSet.add(pathStr);
      return newSet;
    });

    // If opening and hasChildren but no children loaded, fetch them
    if (!currentlyOpen && hasChildren && activeDatabase) {
      // Check if children already exist in structure
      // We need to traverse dbStructure to find the node.
      // Or simpler: just trigger fetch. If we fetch again, it's okay (refresh).
      // Optimization: Check if we have children.
      // Traversing dbStructure is recursive.
      // Let's just fetch for now to ensure freshness and simplicity of finding the node.

      const dbId = activeDatabase.slug || activeDatabase.id;
      // const parentPathStr = KeyCodec.encode(path);
      api.getNodes(dbId, path).then((res) => {
        const nodes = res.items;

        if (nodes && Object.keys(nodes).length > 0) {
          setDbStructure((prev) => {
            if (!prev) return nodes;
            return mergeStructure(prev, path, nodes, res.cursor);
          });
        }
      });
    }
  };

  const navigateToRoot = () => {
    pathInfo.value = [];
  };

  if (!activeDatabase) {
    // If databases are loaded but activeDatabase is not found, it means 404 (assuming selectedDatabase is set)
    if (databases.value.length > 0 && selectedDatabase.value) {
      return (
        <div class="flex flex-col items-center justify-center h-screen gap-4">
          <h1 class="text-2xl font-bold">Database Not Found</h1>
          <p class="text-base-content/60">
            The database you are looking for does not exist or has been deleted.
          </p>
          <a href="/" class="btn btn-primary">Go Home</a>
        </div>
      );
    }
    return <div class="p-10 text-center">Loading database...</div>;
  }

  // Determine Icon based on DB type
  const getDbIcon = (type: string, className = "w-4 h-4") => {
    if (type === "file") return <FileDatabaseIcon className={className} />;
    if (type === "memory") return <MemoryDatabaseIcon className={className} />;
    if (type === "remote") return <RemoteDatabaseIcon className={className} />;
    return <DatabaseIcon className={className} />;
  };

  return (
    <div class="flex h-screen w-full overflow-hidden">
      <style>{styles}</style>

      {/* Sidebar */}
      <div
        class={`relative flex flex-col bg-base-200 border-r border-base-300 transition-all duration-75 ease-out ${
          !sidebarOpen.value ? "w-0 min-w-0 overflow-hidden border-none" : ""
        }`}
        style={{
          width: sidebarOpen.value ? `${sidebarWidth.value}px` : "0px",
        }}
      >
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          <ul class="menu w-full p-0 block">
            <li class="border-b border-neutral-600 flex flex-row items-center p-1! gap-1 sticky top-0 bg-base-200 z-10">
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
              const DbIcon = getDbIcon(db.type, "w-4 h-4");

              if (!isActive) {
                return (
                  <li key={db.id}>
                    <a
                      href={`/${db.slug || db.id}`}
                      class="w-full group flex items-center gap-2 p-1 rounded cursor-pointer list-none hover:bg-base-300"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        contextMenu.value = {
                          x: e.clientX,
                          y: e.clientY,
                          type: "database",
                          path: [],
                          dbId: db.id,
                        };
                      }}
                    >
                      <span class="w-4 h-4 flex items-center justify-center shrink-0 opacity-50">
                        {DbIcon}
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
                      class="w-full group flex items-center gap-2 p-1 rounded cursor-pointer list-none bg-neutral text-neutral-content font-bold hover:bg-neutral relative"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToRoot();
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        contextMenu.value = {
                          x: e.clientX,
                          y: e.clientY,
                          type: "database",
                          path: [], // Root
                          dbId: db.id,
                        };
                      }}
                    >
                      <span class="w-4 h-4 flex items-center justify-center shrink-0">
                        {DbIcon}
                      </span>
                      <span class="flex-1 truncate">{db.name || db.id}</span>
                    </summary>
                    {dbStructure && (
                      <ul>
                        {Object.entries(dbStructure)
                          .filter(([_, node]) =>
                            node.hasChildren ||
                            (node.children &&
                              Object.keys(node.children).length > 0)
                          )
                          .map(([key, node]) => (
                            <Node
                              node={node}
                              key={key}
                              pathInfo={pathInfo}
                              openPaths={openPaths}
                              gonePaths={gonePaths.value}
                              prettyPrintDates={activeDatabase?.settings
                                ?.prettyPrintDates ??
                                true}
                              onToggle={togglePath}
                              onContextMenu={(e, path) =>
                                contextMenu.value = {
                                  x: e.clientX,
                                  y: e.clientY,
                                  type: "folder",
                                  path,
                                }}
                              onLoadMore={(path, cursor) => {
                                const dbId = activeDatabase?.slug ||
                                  activeDatabase?.id;
                                if (!dbId) return;

                                api.getNodes(dbId, path, { cursor }).then(
                                  (res) => {
                                    const nodes = res.items;
                                    if (
                                      nodes && Object.keys(nodes).length > 0
                                    ) {
                                      setDbStructure((prev) => {
                                        if (!prev) return nodes;
                                        return mergeStructure(
                                          prev,
                                          path,
                                          nodes,
                                          res.cursor,
                                        );
                                      });
                                    }
                                  },
                                );
                              }}
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
        {/* Resize Handle */}
        <div
          class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-20"
          onMouseDown={() => isResizing.value = true}
        />
      </div>

      {/* Main Content */}
      <div class="flex-1 flex flex-col h-full min-w-0 bg-base-100">
        <div class="px-4 py-1 flex-none border-b border-base-300">
          <div class="flex justify-between items-center py-1">
            <div class="flex items-center gap-2">
              {/* Bulk Actions / Selection Info */}
              {(selectedKeys.value.size > 0 || selectAllMatching.value)
                ? (
                  <div class="flex items-center gap-2 bg-base-200 px-2 py-1 rounded">
                    <span class="text-xs font-bold">
                      {selectionCount} selected
                    </span>
                    {activeDatabase?.mode !== "r" && (
                      <button
                        type="button"
                        class="btn btn-xs btn-error btn-outline"
                        onClick={handleBulkDelete}
                      >
                        Delete
                      </button>
                    )}
                    {/* "Select All Matching" Offer */}
                    {!selectAllMatching.value && allVisibleSelected && (
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost text-xs"
                        onClick={() => selectAllMatching.value = true}
                      >
                        Select all matching
                      </button>
                    )}
                  </div>
                )
                : (
                  /* Standard Header Controls */
                  !sidebarOpen.value && (
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
                  )
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
                prettyPrintDates={activeDatabase?.settings?.prettyPrintDates ??
                  true}
              />
            </div>
            {activeDatabase && activeDatabase.mode !== "r" && (
              <button
                class="btn btn-xs bg-brand hover:bg-brand/80 text-black border-none shrink-0 shadow-sm hover:shadow-md transition-all"
                type="button"
                onClick={() => {
                  selectedEntry.value = null;
                  createEntryRef.current?.showModal();
                }}
              >
                +
              </button>
            )}
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 content-start">
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
                const convertValue = (p: ApiKvKeyPart) => {
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
                const realKey = selectedEntry.value.key.map(convertValue);

                api.deleteRecord(
                  activeDatabase.slug || activeDatabase.id,
                  realKey,
                ).then(() => {
                  createEntryRef.current?.close();
                  if (pathInfo.value) pathInfo.value = [...pathInfo.value];
                  api.getDatabase(activeDatabase.slug || activeDatabase.id)
                    .then((
                      s,
                    ) => setDbStructure(s));
                }).catch((e: Error | unknown) =>
                  alert(e instanceof Error ? e.message : String(e))
                );
              }}
              onSubmit={(data, _form) => {
                if (!activeDatabase) return;
                const convertValue = (p: ApiKvKeyPart) => {
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
                let oldKey: unknown[] | undefined;
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
                  api.getDatabase(activeDatabase.slug || activeDatabase.id)
                    .then((
                      s,
                    ) => setDbStructure(s));
                }).catch((e: Error | unknown) =>
                  alert(e instanceof Error ? e.message : String(e))
                );
              }}
            />
          </Dialog>

          <div>
            {activeDatabase && (records.value.length
              ? (
                <div class="join join-vertical w-full">
                  {/* "Select All" Header Row */}
                  <div class="join-item bg-base-100 border-base-300 border-x border-t p-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs"
                      checked={allVisibleSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = selectedKeys.value.size > 0 &&
                            !allVisibleSelected;
                        }
                      }}
                      onClick={toggleSelectVisible}
                    />
                    <span class="text-xs font-bold opacity-50">Select All</span>
                  </div>

                  {records.value.map((entry) => (
                    <RecordItem
                      key={KeyCodec.encode(entry.key)}
                      record={entry}
                      isSelected={selectAllMatching.value ||
                        selectedKeys.value.has(KeyCodec.encode(entry.key))}
                      onToggleSelection={() => toggleSelection(entry.key)}
                      onEdit={() => {
                        selectedEntry.value = entry;
                        createEntryRef.current?.showModal();
                      }}
                      isReadOnly={activeDatabase?.mode === "r"}
                    />
                  ))}

                  {/* Pagination Controls */}
                  <div class="join-item bg-base-100 border-base-300 border-x border-b p-2 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xs opacity-50">
                        Show
                      </span>
                      <select
                        class="select select-bordered select-xs"
                        value={limit.value}
                        onChange={(e) =>
                          limit.value = parseInt(e.currentTarget.value)}
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>

                    <div class="join">
                      <button
                        type="button"
                        class="join-item btn btn-xs"
                        disabled={cursorStack.value.length === 0}
                        onClick={() => {
                          const stack = [...cursorStack.value];
                          const prev = stack.pop();
                          cursorStack.value = stack;
                          cursor.value = prev;
                        }}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        class="join-item btn btn-xs"
                        disabled={!nextCursor.value}
                        onClick={() => {
                          cursorStack.value = [
                            ...cursorStack.value,
                            cursor.value,
                          ];
                          cursor.value = nextCursor.value;
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )
              : (
                <div class="p-10 text-center text-base-content/50">
                  {(() => {
                    // Check if we have known children in the local structure
                    let hasKnownChildren = false;
                    if (dbStructure) {
                      const currentPath = pathInfo.value || [];
                      if (currentPath.length === 0) {
                        hasKnownChildren = Object.keys(dbStructure).length > 0;
                      } else {
                        let current = dbStructure;
                        let found = true;
                        for (const part of currentPath) {
                          const match = Object.values(current).find((c) =>
                            c.value === part.value && c.type === part.type
                          );
                          if (match && match.children) {
                            current = match.children;
                          } else if (match) {
                            current = {};
                          } else {
                            found = false;
                            break;
                          }
                        }
                        if (found && Object.keys(current).length > 0) {
                          hasKnownChildren = true;
                        }
                      }
                    }

                    if (
                      pathInfo.value && pathInfo.value.length > 0 &&
                      gonePaths.value.has(KeyCodec.encode(pathInfo.value)) &&
                      !hasKnownChildren
                    ) {
                      return (
                        <div class="alert alert-warning text-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="stroke-current shrink-0 h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <span>Record not found (deleted or moved)</span>
                        </div>
                      );
                    }
                    // For empty root or empty folder
                    if (activeDatabase) {
                      return <p class="text-sm">No records found</p>;
                    }

                    return (
                      <p class="text-sm">Select a database to view records</p>
                    );
                  })()}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.value && (
        <div
          class="fixed z-50 bg-base-100 border border-base-300 shadow-lg rounded py-1 min-w-[150px]"
          style={{ top: contextMenu.value.y, left: contextMenu.value.x }}
        >
          {contextMenu.value.type === "database"
            ? (
              <>
                <button
                  type="button"
                  class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
                  onClick={() => {
                    // Close menu
                    const dbId = contextMenu.value?.dbId;
                    contextMenu.value = null;
                    if (dbId) {
                      // If not active, redirect
                      if (
                        !activeDatabase ||
                        (activeDatabase.id !== dbId &&
                          activeDatabase.slug !== dbId)
                      ) {
                        const db = databases.value.find((d) => d.id === dbId);
                        globalThis.location.href = `/${db?.slug || dbId}`;
                        return;
                      }

                      // 1. Fetch Key Structure (for open nodes)
                      // 1. Fetch Key Structure (for open nodes)
                      api.getNodes(dbId, []).then((res) => {
                        const nodes = res.items;
                        if (
                          nodes && activeDatabase &&
                          (activeDatabase.id === dbId ||
                            activeDatabase.slug === dbId)
                        ) {
                          setDbStructure((prev) => {
                            if (!prev) {
                              return nodes;
                            }
                            return mergeStructure(prev, [], nodes, res.cursor);
                          });
                        }
                      });
                      // 2. Refresh List
                      api.getDatabases().then((res) => {
                        if (res.data) {
                          databases.value = res.data;
                        }
                      });

                      // 3. Refresh Records if active
                      if (
                        activeDatabase &&
                        (activeDatabase.id === dbId ||
                          activeDatabase.slug === dbId)
                      ) {
                        // Ensure we refresh the current view
                        api.getRecords(
                          dbId,
                          pathInfo.value || [],
                          cursor.value,
                          limit.value,
                          { recursive: false },
                        ).then((res) => {
                          records.value = res.records;
                          nextCursor.value = res.cursor;
                          const r = res.records;
                          // Check for gone path
                          if (
                            r.length === 0 && pathInfo.value &&
                            pathInfo.value.length > 0
                          ) {
                            const pathStr = KeyCodec.encode(pathInfo.value);
                            if (!gonePaths.value.has(pathStr)) {
                              gonePaths.value = new Set(gonePaths.value).add(
                                pathStr,
                              );
                            }
                          }
                        }).catch((err) => {
                          console.error("Failed to refresh records:", err);
                        });
                      }
                    }
                  }}
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
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  {/* Change label if inactive? User said "Refresh", but action is open. Keep "Refresh" or change to "Open"? "Refresh" implies staying. "Open" implies moving. */}
                  {activeDatabase &&
                      (activeDatabase.id === contextMenu.value?.dbId ||
                        activeDatabase.slug === contextMenu.value?.dbId)
                    ? "Refresh"
                    : "Open"}
                </button>
                <button
                  type="button"
                  class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
                  onClick={() => {
                    const dbId = contextMenu.value?.dbId;
                    contextMenu.value = null;
                    if (dbId) {
                      const db = databases.value.find((d) =>
                        d.id === dbId
                      );
                      if (db) {
                        editingDatabase.value = db;
                        createDatabaseRef.current?.showModal();
                      }
                    }
                  }}
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
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                    />
                  </svg>
                  Edit
                </button>
              </>
            )
            : (
              <>
                <button
                  type="button"
                  class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
                  onClick={() => {
                    // Refresh this folder
                    const dbId = activeDatabase?.slug || activeDatabase?.id;
                    const targetPath = contextMenu.value?.path;
                    contextMenu.value = null;

                    if (dbId && targetPath) {
                      // If the current view is within this folder (or IS this folder), refresh records
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

                      // Refresh structure to check for children updates
                      // Ideally yes, but expensive. Let's just do records for now as that's what user likely wants.
                      // Actually, let's refresh structure too for completeness if it's a folder.
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
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  Refresh
                </button>
                {activeDatabase?.mode !== "r" && (
                  <button
                    type="button"
                    class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm text-error flex items-center gap-2"
                    onClick={handleFolderDelete}
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
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                      />
                    </svg>
                    Delete
                  </button>
                )}
              </>
            )}
        </div>
      )}

      {/* Edit Database Dialog - Always available */}
      <Dialog ref={createDatabaseRef} title="Edit Database">
        {(editingDatabase.value || activeDatabase) && (
          <ConnectDatabaseForm
            database={editingDatabase.value || activeDatabase}
            onCancel={() => createDatabaseRef.current?.close()}
            onDelete={() => {
              const id = editingDatabase.value?.id || activeDatabase?.id;
              if (id) {
                api.deleteDatabase(id)
                  .then(() => {
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
                api.updateDatabase({ id, ...data })
                  .then((updatedDb: unknown) => {
                    const db = updatedDb as Database;
                    const target = activeDatabase?.slug === dbId
                      ? (db.slug || db.id)
                      : (db.slug || db.id);
                    globalThis.location.href = `/${target}`;
                  });
              }
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
