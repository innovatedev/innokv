import { Signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiKvKeyPart, DbNode } from "@/lib/types.ts";
import { KeyDisplay } from "./KeyDisplay.tsx";
import { Database } from "@/kv/models.ts";
import {
  ChevronRightIcon,
  LockIcon,
} from "../../components/icons/ActionIcons.tsx";
import { DatabaseIcon } from "../../components/icons/DatabaseIcons.tsx";
import { KeyCodec } from "@/lib/KeyCodec.ts";

interface BreadcrumbsProps {
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  dbStructure: Record<string, DbNode> | null;
  currentDbName: string;
  navigateToRoot: () => void;
  databases: Database[];
  onSwitchDatabase: (id: string) => void;
  prettyPrintDates: boolean;
  isReadOnly: boolean;
  onLoadNodes: (path: ApiKvKeyPart[]) => void;
  onContextMenu: (
    e: MouseEvent | PointerEvent,
    type: "folder" | "item" | "database",
    path: ApiKvKeyPart[],
    dbId?: string,
  ) => void;
  onEditDatabase?: () => void;
  activeDatabase: Database | null;
}

export const Breadcrumbs = (
  {
    pathInfo,
    dbStructure,
    currentDbName,
    navigateToRoot,
    databases,
    onSwitchDatabase,
    prettyPrintDates,
    isReadOnly,
    onLoadNodes,
    onContextMenu,
    onEditDatabase,
    activeDatabase,
  }: BreadcrumbsProps,
) => {
  // Helper to get children of a path from dbStructure
  const getChildren = (
    parents: ApiKvKeyPart[],
  ): Record<string, DbNode> | null => {
    if (!dbStructure) return null;
    let current: Record<string, DbNode> | null = dbStructure;
    for (const p of parents) {
      const key: string | undefined = Object.keys(current!).find((k) => {
        const child = current![k];
        return KeyCodec.encodePart(child) === KeyCodec.encodePart(p);
      });
      if (key && current![key]?.children) {
        current = current![key].children!;
      } else {
        return null;
      }
    }
    return current;
  };

  // Helper to get a specific node from dbStructure
  const getNode = (
    parents: ApiKvKeyPart[],
  ): DbNode | null => {
    if (!dbStructure || parents.length === 0) return null;
    const parentPath = parents.slice(0, -1);
    const lastPart = parents[parents.length - 1];
    const siblings = parentPath.length === 0
      ? dbStructure
      : getChildren(parentPath);
    if (!siblings) return null;
    const key = Object.keys(siblings).find((k) => {
      const n = siblings[k];
      return KeyCodec.encodePart(n) === KeyCodec.encodePart(lastPart);
    });
    return key ? siblings[key] : null;
  };

  const rootChildren = dbStructure;
  const path = pathInfo.value || [];

  return (
    <div class="breadcrumbs text-sm custom-breadcrumbs flex items-center">
      <ul class="flex-wrap flex items-center p-0 m-0">
        <li class="flex items-center gap-0.5">
          <DatabaseSwitcher
            databases={databases}
            onSwitch={onSwitchDatabase}
            onContextMenu={onContextMenu}
          />
          <a
            class="hover:underline font-bold flex items-center gap-1 cursor-pointer"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (path.length === 0 && onEditDatabase) {
                onEditDatabase();
              } else {
                navigateToRoot();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (activeDatabase) {
                onContextMenu(
                  e,
                  "database",
                  [],
                  activeDatabase.slug || activeDatabase.id,
                );
              }
            }}
          >
            {currentDbName}
            {isReadOnly && (
              <div
                class="flex items-center gap-1 ml-1 tooltip tooltip-bottom"
                data-tip="Read Only"
              >
                <LockIcon className="w-3.5 h-3.5 text-warning" />
              </div>
            )}
          </a>
          <BreadcrumbSeparator
            candidates={rootChildren}
            basePath={[]}
            pathInfo={pathInfo}
            isLast={path.length === 0}
            prettyPrintDates={prettyPrintDates}
            onLoadNodes={() => onLoadNodes([])}
            hasChildren
            onContextMenu={onContextMenu}
          />
        </li>

        {path.map((node, i) => {
          const myPath = path.slice(0, i + 1);
          const children = getChildren(myPath);
          const fullNode = getNode(myPath);

          return (
            <li key={`pathInfo-${i}`} class="flex items-center gap-0.5">
              <a
                class="block max-w-xs text-left truncate px-1 hover:bg-base-200 rounded hover:underline cursor-pointer"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  pathInfo.value = myPath;
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu(
                    e,
                    "folder",
                    myPath,
                    activeDatabase?.slug || activeDatabase?.id,
                  );
                }}
              >
                <KeyDisplay
                  type={node.type}
                  value={node.value}
                  prettyPrint={prettyPrintDates}
                />
              </a>
              <BreadcrumbSeparator
                candidates={children}
                basePath={myPath}
                pathInfo={pathInfo}
                isLast={i === path.length - 1}
                prettyPrintDates={prettyPrintDates}
                onLoadNodes={() => onLoadNodes(myPath)}
                hasChildren={fullNode?.hasChildren}
                onContextMenu={onContextMenu}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const DatabaseSwitcher = (
  { databases, onSwitch, onContextMenu }: {
    databases: Database[];
    onSwitch: (id: string) => void;
    onContextMenu: (
      e: MouseEvent | PointerEvent,
      type: "folder" | "item" | "database",
      path: ApiKvKeyPart[],
      dbId?: string,
    ) => void;
  },
) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen && dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div
      class={`dropdown dropdown-bottom mr-1 ${isOpen ? "dropdown-open" : ""}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        class="relative z-10 btn btn-ghost btn-xs px-0.5 min-h-0 h-5 w-auto flex items-center justify-center rounded-sm hover:bg-base-300 cursor-pointer gap-0.5"
      >
        <DatabaseIcon className="w-4 h-4 text-base-content/70" />
        <ChevronRightIcon
          className={`w-3 h-3 text-base-content/50 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>
      {isOpen && (
        <ul
          tabindex={0}
          style={{
            display: isOpen ? "block" : "none",
            opacity: 1,
            visibility: "visible",
          }}
          class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-52 overflow-y-auto block border border-base-200"
          onClick={(e) => e.stopPropagation()}
        >
          {databases.map((db) => (
            <li key={db.id}>
              <a
                class="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  onSwitch(db.id);
                  setIsOpen(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu(
                    e,
                    "database",
                    [],
                    db.slug || db.id,
                  );
                }}
              >
                {db.name || db.id}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const BreadcrumbSeparator = (
  {
    candidates,
    basePath,
    pathInfo,
    isLast,
    prettyPrintDates,
    onLoadNodes,
    hasChildren,
    onContextMenu,
  }: {
    candidates: Record<string, DbNode> | null;
    basePath: ApiKvKeyPart[];
    pathInfo: Signal<ApiKvKeyPart[] | null>;
    isLast: boolean;
    prettyPrintDates: boolean;
    onLoadNodes: () => void;
    hasChildren?: boolean;
    onContextMenu: (
      e: MouseEvent | PointerEvent,
      type: "folder" | "item" | "database",
      path: ApiKvKeyPart[],
      dbId?: string,
    ) => void;
  },
) => {
  const nodes = candidates ? Object.values(candidates) : [];
  const subKeys = nodes.filter((n) => n.hasChildren);
  const hasLoadedNodes = nodes.length > 0;

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen && dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const Chevron = (
    <ChevronRightIcon
      className={`w-3 h-3 text-base-content/50 transition-transform duration-200 ${
        isOpen ? "rotate-90" : ""
      }`}
    />
  );

  // Simplified visibility: 
  // - If it's not the last item, we MUST show it to separate segments.
  // - If it's the last item, we show it to allow discovery, unless confirmed empty.
  if (isLast && hasLoadedNodes && nodes.length === 0) return null;

  return (
    <div
      class={`dropdown dropdown-bottom ${isOpen ? "dropdown-open" : ""}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if (!isOpen && !hasLoadedNodes && (hasChildren || isLast)) {
            setLoading(true);
            onLoadNodes();
            // We wait a bit for the data to arrive before opening
            setTimeout(() => {
              setLoading(false);
              setIsOpen(true);
            }, 500);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        class={`relative z-10 btn btn-ghost btn-xs px-0.5 min-h-0 h-5 w-5 flex items-center justify-center rounded-sm hover:bg-base-300 cursor-pointer ${
          loading ? "loading loading-spinner loading-xs" : ""
        }`}
      >
        {!loading && Chevron}
      </button>
      {isOpen && (
        <ul
          tabindex={0}
          style={{
            display: isOpen ? "block" : "none",
            opacity: 1,
            visibility: "visible",
          }}
          class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-64 max-h-80 overflow-y-auto flex-nowrap block border border-base-200"
          onClick={(e) => e.stopPropagation()}
        >
          {loading
            ? (
              <li class="disabled px-4 py-2 opacity-50 text-xs text-center italic">
                Loading...
              </li>
            )
            : subKeys.length > 0
            ? (
              <>
                {subKeys.map((subKey) => (
                  <li key={KeyCodec.encodePart(subKey)}>
                    <a
                      class="cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        pathInfo.value = [...basePath, subKey];
                        setIsOpen(false);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onContextMenu(e, "folder", [...basePath, subKey]);
                      }}
                    >
                      <KeyDisplay
                        type={subKey.type}
                        value={subKey.value}
                        prettyPrint={prettyPrintDates}
                      />
                    </a>
                  </li>
                ))}
              </>
            )
            : (
              <li class="disabled px-4 py-2 opacity-50 text-xs text-center">
                No sub-keys found
              </li>
            )}
        </ul>
      )}
    </div>
  );
};
