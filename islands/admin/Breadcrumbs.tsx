import { Signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiKvKeyPart, DbNode } from "@/lib/types.ts";
import { KeyDisplay } from "./KeyDisplay.tsx";

interface BreadcrumbsProps {
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  dbStructure: Record<string, DbNode> | null;
  currentDbName: string;
  navigateToRoot: () => void;
  databases: any[];
  onSwitchDatabase: (id: string) => void;
}

export const Breadcrumbs = (
  {
    pathInfo,
    dbStructure,
    currentDbName,
    navigateToRoot,
    databases,
    onSwitchDatabase,
  }: BreadcrumbsProps,
) => {
  // Helper to get children of a path from dbStructure
  const getChildren = (
    parents: ApiKvKeyPart[],
  ): Record<string, DbNode> | null => {
    if (!dbStructure) return null;
    let current: Record<string, DbNode> | null = dbStructure;
    for (const p of parents) {
      const key = Object.keys(current!).find((k) => {
        const n = current![k];
        return n.type === p.type && n.value === p.value;
      });
      if (key && current![key]?.children) {
        current = current![key].children!;
      } else {
        return null;
      }
    }
    return current;
  };

  const rootChildren = dbStructure;
  const path = pathInfo.value || [];

  return (
    <div class="breadcrumbs text-sm custom-breadcrumbs flex items-center">
      <ul class="flex-wrap flex items-center p-0 m-0">
        {/* Root */}
        <li class="flex items-center gap-0.5">
          <DatabaseSwitcher
            databases={databases}
            onSwitch={onSwitchDatabase}
          />
          <button
            class="hover:underline font-bold"
            type="button"
            onClick={navigateToRoot}
          >
            {currentDbName}
          </button>
          <BreadcrumbSeparator
            candidates={rootChildren}
            basePath={[]}
            pathInfo={pathInfo}
            isLast={path.length === 0}
          />
        </li>

        {path.map((node, i) => {
          const myPath = path.slice(0, i + 1);
          const children = getChildren(myPath);

          return (
            <li key={`pathInfo-${i}`} class="flex items-center gap-0.5">
              <button
                class="block max-w-xs text-left truncate px-1 hover:bg-base-200 rounded hover:underline"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  pathInfo.value = myPath;
                }}
              >
                <KeyDisplay type={node.type} value={node.value} />
              </button>
              <BreadcrumbSeparator
                candidates={children}
                basePath={myPath}
                pathInfo={pathInfo}
                isLast={i === path.length - 1}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const DatabaseSwitcher = (
  { databases, onSwitch }: { databases: any[]; onSwitch: (id: string) => void },
) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasMultiple = databases.length > 0; // Always show if we have standard list

  // Close on outside click
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
        {/* Database Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-4 h-4 text-base-content/70"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 12h14M5 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M5 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2"
          />
        </svg>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class={`w-3 h-3 text-base-content/50 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m8.25 4.5 7.5 7.5-7.5 7.5"
          />
        </svg>
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

const BreadcrumbSeparator = ({ candidates, basePath, pathInfo, isLast }: {
  candidates: Record<string, DbNode> | null;
  basePath: ApiKvKeyPart[];
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  isLast: boolean;
}) => {
  // Filter to only show keys that have children (folders)
  const folders = candidates
    ? Object.values(candidates).filter((n: DbNode) =>
      n.children && Object.keys(n.children).length > 0
    )
    : [];
  const hasFolders = folders.length > 0;

  // Check if the single available folder is already the selected next step
  const nextSegment = pathInfo.value && pathInfo.value.length > basePath.length
    ? pathInfo.value[basePath.length]
    : null;
  const isRedundant = folders.length === 1 && nextSegment &&
    folders[0].value === nextSegment.value &&
    folders[0].type === nextSegment.type;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      class={`w-3 h-3 text-base-content/50 transition-transform duration-200 ${
        isOpen ? "rotate-90" : ""
      }`}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );

  // If last item and no folders, don't show separator
  if (isLast && !hasFolders) return null;

  // Static Separator (between items, but no folders to switch to, or the only option is already selected)
  if (!hasFolders || isRedundant) {
    return <div class="px-0.5 opacity-40">{Chevron}</div>;
  }

  // Interactive Dropdown
  return (
    <div
      class={`dropdown dropdown-bottom ${isOpen ? "dropdown-open" : ""}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        class="relative z-10 btn btn-ghost btn-xs px-0.5 min-h-0 h-5 w-5 flex items-center justify-center rounded-sm hover:bg-base-300 cursor-pointer"
      >
        {Chevron}
      </button>
      {isOpen && (
        <ul
          tabindex={0}
          style={{
            display: isOpen ? "block" : "none",
            opacity: 1,
            visibility: "visible",
          }}
          class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-52 max-h-60 overflow-y-auto flex-nowrap block border border-base-200"
          onClick={(e) => e.stopPropagation()}
        >
          {folders.map((folder: DbNode) => (
            <li key={folder.value}>
              <a
                onClick={() => {
                  pathInfo.value = [...basePath, folder];
                  setIsOpen(false);
                }}
              >
                <KeyDisplay type={folder.type} value={folder.value} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
