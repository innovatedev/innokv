import { Signal } from "@preact/signals";
import { Database } from "@/kv/models.ts";
import { ApiKvKeyPart, DbNode } from "@/lib/types.ts";
import { Breadcrumbs } from "./Breadcrumbs.tsx";
import {
  PlusIcon,
  SearchIcon,
  SwapIcon,
} from "../../components/icons/ActionIcons.tsx";

interface ToolbarProps {
  activeDatabase: Database | null;
  databases: Database[];
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  dbStructure: Record<string, DbNode> | null;
  currentDbName: string;
  selectedKeys: Signal<Set<string>>;
  selectAllMatching: Signal<boolean>;
  selectionCount: number | string;
  allVisibleSelected: boolean;
  searchQuery: Signal<string>;
  isSearchActive: Signal<boolean>;
  searchTarget: Signal<"key" | "value" | "all">;
  searchRegex: Signal<boolean>;
  searchCaseSensitive: Signal<boolean>;
  onNavigateToRoot: () => void;
  onSwitchDatabase: (id: string) => void;
  onNewRecord: () => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onBulkDelete: () => void;
  onExport: (recursive: boolean) => void;
  onImport: () => void;
}

export default function Toolbar(
  {
    activeDatabase,
    databases,
    pathInfo,
    dbStructure,
    currentDbName,
    selectedKeys,
    selectAllMatching,
    selectionCount,
    allVisibleSelected,
    searchQuery,
    isSearchActive,
    searchTarget,
    searchRegex,
    searchCaseSensitive,
    onNavigateToRoot,
    onSwitchDatabase,
    onNewRecord,
    onSearch,
    onClearSearch,
    onBulkDelete,
    onExport,
    onImport,
  }: ToolbarProps,
) {
  return (
    <div class="px-4 py-1 flex-none border-b border-base-300">
      <div class="flex justify-between items-center py-1">
        {/* Changed overflow-hidden to overflow-visible to fix breadcrumb dropdowns */}
        <div class="flex items-center gap-2 overflow-visible min-w-0 flex-1 px-2">
          {(selectedKeys.value.size > 0 || selectAllMatching.value) && (
            <div class="flex items-center gap-2 bg-base-200 px-2 py-1 rounded shrink-0">
              <span class="text-xs font-bold">
                {selectionCount} selected
              </span>
              <button
                type="button"
                class="btn btn-xs btn-ghost text-xs opacity-50 hover:opacity-100"
                onClick={() => {
                  selectedKeys.value = new Set();
                  selectAllMatching.value = false;
                }}
              >
                Clear
              </button>
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
          )}

          <Breadcrumbs
            pathInfo={pathInfo}
            dbStructure={dbStructure}
            currentDbName={currentDbName}
            navigateToRoot={onNavigateToRoot}
            databases={databases}
            onSwitchDatabase={onSwitchDatabase}
            prettyPrintDates={activeDatabase?.settings?.prettyPrintDates ??
              true}
            isReadOnly={activeDatabase?.mode === "r"}
          />

          {activeDatabase && activeDatabase.mode !== "r" && (
            <button
              class="btn btn-xs btn-square bg-brand hover:bg-brand/80 text-black border-none shrink-0 ml-1 shadow-sm hover:shadow-md transition-all"
              type="button"
              title="New Record"
              onClick={onNewRecord}
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          )}

        </div>

        <div class="flex items-center gap-1 shrink-0 px-2">
          {(selectedKeys.value.size > 0 || selectAllMatching.value) &&
            activeDatabase?.mode !== "r" && (
            <button
              type="button"
              class="btn btn-xs btn-error btn-outline"
              onClick={onBulkDelete}
            >
              Delete
            </button>
          )}

          {activeDatabase && (
            <div class="dropdown dropdown-end">
              <label
                tabindex={0}
                class="btn btn-xs btn-ghost px-1 opacity-70 hover:opacity-100"
                title="Export / Import"
              >
                <SwapIcon className="w-4 h-4" />
              </label>
              <ul
                tabindex={0}
                class="dropdown-content z-20 menu p-2 shadow-xl bg-base-100 rounded-box w-60 border border-base-300"
              >
                {selectAllMatching.value && (
                  <li>
                    <a
                      onClick={() => onExport(true)}
                      class="font-bold text-primary"
                    >
                      Export All Matching ({selectionCount})
                    </a>
                  </li>
                )}
                {selectedKeys.value.size > 0 && !selectAllMatching.value &&
                  (
                    <li>
                      <a
                        onClick={() => onExport(false)}
                        class="font-bold text-primary"
                      >
                        Export Selected ({selectedKeys.value.size})
                      </a>
                    </li>
                  )}
                {(selectedKeys.value.size > 0 || selectAllMatching.value) &&
                  <div class="divider my-0 opacity-50"></div>}
                <li>
                  <a onClick={() => onExport(true)}>
                    Export Folder (Recursive)
                  </a>
                </li>
                <li>
                  <a onClick={() => onExport(false)}>
                    Export Folder (Shallow)
                  </a>
                </li>
                {activeDatabase.mode !== "r" && (
                  <>
                    <div class="divider my-0"></div>
                    <li>
                      <a onClick={onImport}>
                        Import JSON file
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div class="flex items-center gap-2 pb-2 px-2">
        <div class="relative flex items-center flex-1 group max-w-lg">
          <div class="absolute left-3 text-base-content/30 group-focus-within:text-primary transition-colors">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search records..."
            class={`input input-sm input-bordered pl-10 pr-16 w-full transition-all duration-300 rounded-lg bg-base-200/50 focus:bg-base-100 ${
              isSearchActive.value ? "ring-1 ring-primary" : ""
            }`}
            value={searchQuery.value}
            onInput={(e) => {
              searchQuery.value = e.currentTarget.value;
              if (!searchQuery.value) onClearSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSearch();
              }
              if (e.key === "Escape") {
                onClearSearch();
              }
            }}
          />
          <div class="absolute right-2 flex items-center gap-2">
            {searchQuery.value && (
              <button
                type="button"
                class="btn btn-ghost btn-circle btn-xs h-6 w-6 min-h-0"
                onClick={onClearSearch}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="w-3 h-3"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            <div class="dropdown dropdown-end">
              <label
                tabindex={0}
                class="cursor-pointer text-xs opacity-40 hover:opacity-100 px-2 py-1 font-bold hover:bg-base-300 rounded transition-colors"
              >
                {searchTarget.value[0].toUpperCase() +
                  searchTarget.value.slice(1)}
              </label>
              <ul
                tabindex={0}
                class="dropdown-content z-30 menu p-2 shadow-2xl bg-base-100 rounded-box w-48 border border-base-300 mt-2 text-xs"
              >
                <li class="menu-title">Search Target</li>
                <li>
                  <a
                    class={searchTarget.value === "all" ? "active" : ""}
                    onClick={() => searchTarget.value = "all"}
                  >
                    All Fields
                  </a>
                </li>
                <li>
                  <a
                    class={searchTarget.value === "key" ? "active" : ""}
                    onClick={() => searchTarget.value = "key"}
                  >
                    Key Only
                  </a>
                </li>
                <li>
                  <a
                    class={searchTarget.value === "value" ? "active" : ""}
                    onClick={() => searchTarget.value = "value"}
                  >
                    Value Only
                  </a>
                </li>
                <li class="divider my-1"></li>
                <li>
                  <label class="label cursor-pointer py-1 px-2">
                    <span class="label-text text-xs">Regex</span>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs"
                      checked={searchRegex.value}
                      onChange={(e) =>
                        searchRegex.value = e.currentTarget.checked}
                    />
                  </label>
                </li>
                <li>
                  <label class="label cursor-pointer py-1 px-2">
                    <span class="label-text text-xs">Case Sensitive</span>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs"
                      checked={searchCaseSensitive.value}
                      onChange={(e) =>
                        searchCaseSensitive.value = e.currentTarget
                          .checked}
                    />
                  </label>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
