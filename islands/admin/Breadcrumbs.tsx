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
    e: MouseEvent,
    type: "folder" | "item" | "database",
    path: ApiKvKeyPart[],
    dbId?: string,
  ) => void;
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
        return child.value === p.value && child.type === p.type;
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
      return n.value === lastPart.value && n.type === lastPart.type;
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
          />
          <button
            class="hover:underline font-bold flex items-center gap-1"
            type="button"
            onClick={navigateToRoot}
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
          </button>
          <BreadcrumbSeparator
            candidates={rootChildren}
            basePath={[]}
            pathInfo={pathInfo}
            isLast={path.length === 0}
            prettyPrintDates={prettyPrintDates}
            onLoadNodes={() => onLoadNodes([])}
            hasChildren
          />
        </li>

        {path.map((node, i) => {
          const myPath = path.slice(0, i + 1);
          const children = getChildren(myPath);
          const fullNode = getNode(myPath);

          return (
            <li key={`pathInfo-${i}`} class="flex items-center gap-0.5">
              <button
                class="block max-w-xs text-left truncate px-1 hover:bg-base-200 rounded hover:underline"
                type="button"
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
              </button>
              <BreadcrumbSeparator
                candidates={children}
                basePath={myPath}
                pathInfo={pathInfo}
                isLast={i === path.length - 1}
                prettyPrintDates={prettyPrintDates}
                onLoadNodes={() => onLoadNodes(myPath)}
                hasChildren={fullNode?.hasChildren}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const DatabaseSwitcher = (
  { databases, onSwitch }: {
    databases: Database[];
    onSwitch: (id: string) => void;
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
                onClick={() => {
                  onSwitch(db.id);
                  setIsOpen(false);
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
  }: {
    candidates: Record<string, DbNode> | null;
    basePath: ApiKvKeyPart[];
    pathInfo: Signal<ApiKvKeyPart[] | null>;
    isLast: boolean;
    prettyPrintDates: boolean;
    onLoadNodes: () => void;
    hasChildren?: boolean;
  },
) => {
  const folders = candidates
    ? Object.values(candidates).filter((n: DbNode) => n.hasChildren)
    : [];
  const hasLoadedFolders = folders.length > 0;

  const nextSegment = pathInfo.value && pathInfo.value.length > basePath.length
    ? pathInfo.value[basePath.length]
    : null;
  const isRedundant = folders.length === 1 && nextSegment &&
    folders[0].value === nextSegment.value &&
    folders[0].type === nextSegment.type;

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

  if (isLast && !hasChildren && !hasLoadedFolders) return null;

  if (isRedundant && !isLast) {
    return <div class="px-0.5 opacity-40">{Chevron}</div>;
  }

  return (
    <div
      class={`dropdown dropdown-bottom ${isOpen ? "dropdown-open" : ""}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if (!isOpen && !hasLoadedFolders && hasChildren) {
            setLoading(true);
            onLoadNodes();
            setTimeout(() => {
              setLoading(false);
              setIsOpen(true);
            }, 300);
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
          {hasLoadedFolders
            ? folders.map((folder: DbNode) => (
              <li key={folder.value}>
                <a
                  onClick={() => {
                    pathInfo.value = [...basePath, folder];
                    setIsOpen(false);
                  }}
                >
                  <KeyDisplay
                    type={folder.type}
                    value={folder.value}
                    prettyPrint={prettyPrintDates}
                  />
                </a>
              </li>
            ))
            : (
              <li class="disabled px-4 py-2 opacity-50 text-xs">
                No child folders found
              </li>
            )}
        </ul>
      )}
    </div>
  );
};
