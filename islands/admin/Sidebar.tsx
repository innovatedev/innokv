import { KeyCodec } from "@/codec/mod.ts";
import { Signal } from "@preact/signals";
import { Database } from "@/kv/models.ts";
import { ApiKvKeyPart, DbNode } from "@/lib/types.ts";

import { KeyDisplay } from "./KeyDisplay.tsx";
import {
  DatabaseIcon,
  FileDatabaseIcon,
  MemoryDatabaseIcon,
  RemoteDatabaseIcon,
} from "../../components/icons/DatabaseIcons.tsx";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
  RefreshIcon,
} from "../../components/icons/ActionIcons.tsx";

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

  const childrenLoaded = node.children && Object.keys(node.children).length > 0;
  const hasVisibleSubFolders = childrenLoaded
    ? Object.values(node.children!).some((child: DbNode) => child.hasChildren)
    : false;

  const showChevron = node.hasChildren;
  const dimChevron = childrenLoaded && !hasVisibleSubFolders;

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
          {showChevron && (
            <span
              class={`w-4 h-4 flex items-center justify-center p-0 rounded hover:bg-base-300/50 ${
                dimChevron ? "opacity-30 hover:opacity-100" : ""
              }`}
              onClick={toggleOpen}
            >
              <ChevronRightIcon
                className={`w-3 h-3 transition-transform duration-200 ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
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
                type="button"
                class="btn btn-xs btn-ghost text-xs w-full text-left font-normal opacity-50 hover:opacity-100 flex gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  onLoadMore(myPath, node.nextCursor!);
                }}
              >
                <ChevronDownIcon className="w-3 h-3" />
                Load more...
              </button>
            </li>
          )}
        </ul>
      </details>
    </li>
  );
};

interface SidebarProps {
  databases: Database[];
  activeDatabase: Database | null;
  dbStructure: Record<string, DbNode> | null;
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  openPaths: Set<string>;
  gonePaths: Set<string>;
  sidebarOpen: Signal<boolean>;
  sidebarWidth: Signal<number>;
  isResizing: Signal<boolean>;
  onTogglePath: (
    path: ApiKvKeyPart[],
    isOpen: boolean,
    hasChildren: boolean,
  ) => void;
  onNavigateToRoot: () => void;
  onContextMenu: (
    e: MouseEvent,
    type: "database" | "folder",
    path: ApiKvKeyPart[],
    dbId?: string,
  ) => void;
  onLoadMoreNodes: (path: ApiKvKeyPart[], cursor: string) => void;
  onRefresh: () => void;
}

export default function Sidebar(
  {
    databases,
    activeDatabase,
    dbStructure,
    pathInfo,
    openPaths,
    gonePaths,
    sidebarOpen,
    sidebarWidth,
    isResizing,
    onTogglePath,
    onNavigateToRoot,
    onContextMenu,
    onLoadMoreNodes,
    onRefresh,
  }: SidebarProps,
) {
  const getDbIcon = (type: string, className = "w-4 h-4") => {
    if (type === "file") return <FileDatabaseIcon className={className} />;
    if (type === "memory") return <MemoryDatabaseIcon className={className} />;
    if (type === "remote") return <RemoteDatabaseIcon className={className} />;
    return <DatabaseIcon className={className} />;
  };

  return (
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
          <li class="border-b border-base-300 flex flex-row items-center p-1! gap-1 sticky top-0 bg-base-200 z-10">
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

            <div class="flex items-center gap-0.5">
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-square opacity-50 hover:opacity-100"
                onClick={onRefresh}
                title="Refresh"
              >
                <RefreshIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-square opacity-50 hover:opacity-100"
                onClick={() => sidebarOpen.value = false}
                title="Close Sidebar"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
            </div>
          </li>
          {databases.map((db) => {
            const isActive = activeDatabase?.id === db.id;
            const DbIcon = getDbIcon(db.type, "w-4 h-4");

            if (!isActive) {
              return (
                <li key={db.id}>
                  <a
                    href={`/${db.slug || db.id}${
                      typeof globalThis.location !== "undefined"
                        ? globalThis.location.search
                        : ""
                    }`}
                    class="w-full group flex items-center gap-2 p-1 rounded cursor-pointer list-none hover:bg-base-300"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(e, "database", [], db.id);
                    }}
                  >
                    <span class="w-4 h-4 flex items-center justify-center shrink-0 opacity-50">
                      {DbIcon}
                    </span>
                    <span class="flex-1 truncate opacity-70">
                      {db.name || db.id}
                    </span>
                    {db.mode === "r" && (
                      <LockIcon className="w-3 h-3 opacity-30 shrink-0" />
                    )}
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
                      onNavigateToRoot();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(e, "database", [], db.id);
                    }}
                  >
                    <span class="w-4 h-4 flex items-center justify-center shrink-0">
                      {DbIcon}
                    </span>
                    <span class="flex-1 truncate">{db.name || db.id}</span>
                    {db.mode === "r" && (
                      <LockIcon className="w-3 h-3 opacity-50 shrink-0" />
                    )}
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
                            gonePaths={gonePaths}
                            prettyPrintDates={activeDatabase?.settings
                              ?.prettyPrintDates ??
                              true}
                            onToggle={onTogglePath}
                            onContextMenu={(e, path) =>
                              onContextMenu(e, "folder", path)}
                            onLoadMore={onLoadMoreNodes}
                          />
                        ))}
                    </ul>
                  )}
                </details>
              </li>
            );
          })}

          {/* Administration Section */}
          <li class="menu-title mt-4 opacity-40 uppercase text-[0.65rem] font-bold tracking-widest px-2 py-1">
            Administration
          </li>
          <li>
            <a
              href="/admin/users"
              class="flex items-center gap-2 p-1 rounded hover:bg-base-300 opacity-70 hover:opacity-100"
            >
              <div class="w-4 h-4 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span class="text-sm">Users</span>
            </a>
          </li>
          <li>
            <a
              href="/admin/audit-logs"
              class="flex items-center gap-2 p-1 rounded hover:bg-base-300 opacity-70 hover:opacity-100"
            >
              <div class="w-4 h-4 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span class="text-sm">Audit Logs</span>
            </a>
          </li>
        </ul>
      </div>
      <div
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-20"
        onMouseDown={() => isResizing.value = true}
      />
    </div>
  );
}
