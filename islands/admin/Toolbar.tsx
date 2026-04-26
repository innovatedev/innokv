import { Signal } from "@preact/signals";
import { Database } from "@/kv/models.ts";
import { ApiKvKeyPart, DbNode } from "@/lib/types.ts";
import { Breadcrumbs } from "./Breadcrumbs.tsx";
import {
  AaIcon,
  AlertIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshIcon,
  RegexIcon,
  SearchIcon,
  SwapIcon,
} from "../../components/icons/ActionIcons.tsx";

interface ToolbarProps {
  activeDatabase: Database | null;
  databases: Database[];
  sidebarOpen: Signal<boolean>;
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  dbStructure: Record<string, DbNode> | null;
  currentDbName: string;
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
  onRefresh: () => void;
  onLoadNodes: (path: ApiKvKeyPart[]) => void;
  onContextMenu: (
    e: MouseEvent,
    type: "folder" | "item" | "database",
    path: ApiKvKeyPart[],
    dbId?: string,
  ) => void;
  onEditDatabase?: () => void;
}

export default function Toolbar(
  {
    activeDatabase,
    databases,
    sidebarOpen,
    pathInfo,
    dbStructure,
    currentDbName,
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
    onRefresh,
    onLoadNodes,
    onContextMenu,
    onEditDatabase,
  }: ToolbarProps,
) {
  return (
    <div class="flex-none border-b border-base-300 bg-base-200">
      <div class="px-2 h-[41px] flex items-center">
        <div class="flex justify-between items-center w-full">
          <div class="flex items-center gap-2 overflow-visible min-w-0 flex-1 px-1">
            {!sidebarOpen.value && (
              <>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost btn-square opacity-70 hover:opacity-100 shrink-0 mr-1"
                  onClick={() => sidebarOpen.value = true}
                  title="Open Sidebar"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  class="btn btn-xs btn-ghost btn-square opacity-50 hover:opacity-100 shrink-0"
                  onClick={onRefresh}
                  title="Refresh"
                >
                  <RefreshIcon className="w-3 h-3" />
                </button>
              </>
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
              onLoadNodes={onLoadNodes}
              onContextMenu={onContextMenu}
              onEditDatabase={onEditDatabase}
              activeDatabase={activeDatabase}
            />
          </div>

          <div class="flex items-center gap-1 shrink-0 px-2">
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
                      <div class="divider my-0"></div>
                      <li>
                        <a onClick={onBulkDelete} class="text-error">
                          Bulk Delete Folder
                        </a>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 pb-1.5 px-4 justify-between">
        <div class="join flex-1 max-w-xl">
          <div
            class={`relative flex-1 group join-item border transition-colors bg-base-100/50 focus-within:bg-base-100 ${
              isSearchActive.value ? "border-primary" : "border-base-300"
            }`}
          >
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors z-10">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search records..."
              class={`w-full h-8 pl-10 pr-32 text-sm transition-all duration-300 bg-transparent border-none focus:outline-none focus:ring-0 text-base-content`}
              value={searchQuery.value}
              onInput={(e) => {
                searchQuery.value = e.currentTarget.value;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (!searchQuery.value.trim()) {
                    onClearSearch();
                  } else {
                    onSearch();
                  }
                }
                if (e.key === "Escape") {
                  onClearSearch();
                }
              }}
            />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center h-8 gap-1 z-10">
              {searchQuery.value && (
                <button
                  type="button"
                  class="btn btn-ghost btn-circle btn-xs h-6 w-6 min-h-0 opacity-40 hover:opacity-100"
                  onClick={onClearSearch}
                  title="Clear Search"
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

              <div class="flex items-center h-full gap-0.5 border-l border-base-content/10 pl-1.5 ml-1">
                <button
                  type="button"
                  class={`btn btn-ghost btn-square btn-xs h-6 w-6 min-h-0 transition-all ${
                    searchRegex.value
                      ? "text-primary opacity-100"
                      : "text-base-content/30 opacity-60 hover:opacity-100"
                  }`}
                  onClick={() => searchRegex.value = !searchRegex.value}
                  title={searchRegex.value ? "Disable Regex" : "Enable Regex"}
                >
                  <RegexIcon className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  class={`btn btn-ghost btn-square btn-xs h-6 w-6 min-h-0 transition-all ${
                    searchCaseSensitive.value
                      ? "text-primary opacity-100"
                      : "text-base-content/30 opacity-60 hover:opacity-100"
                  }`}
                  onClick={() =>
                    searchCaseSensitive.value = !searchCaseSensitive.value}
                  title={searchCaseSensitive.value
                    ? "Disable Case Sensitive"
                    : "Enable Case Sensitive"}
                >
                  <AaIcon className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  class="cursor-pointer text-[10px] opacity-40 hover:opacity-100 px-1.5 py-1 font-black hover:bg-base-300 rounded transition-colors uppercase leading-none h-6 flex items-center ml-0.5"
                  onClick={() => {
                    if (searchTarget.value === "all") {
                      searchTarget.value = "key";
                    } else if (searchTarget.value === "key") {
                      searchTarget.value = "value";
                    } else {
                      searchTarget.value = "all";
                    }
                  }}
                  title={`Search in: ${searchTarget.value.toUpperCase()}`}
                >
                  {searchTarget.value}
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            class={`btn btn-sm join-item px-4 transition-all border-l-0 ${
              isSearchActive.value
                ? "btn-primary border-primary"
                : "bg-base-200 hover:bg-base-300 border-base-300"
            }`}
            onClick={() => {
              if (searchQuery.value.trim()) onSearch();
              else onClearSearch();
            }}
          >
            Search
          </button>

          <div
            class="tooltip tooltip-left ml-1 flex items-center shrink-0 tooltip-neutral"
            data-tip="Search is in active development. Matches recursively against values (strips type metadata)."
          >
            <div class="p-1 rounded-full bg-base-300 text-base-content/50 hover:bg-base-300/80 transition-colors cursor-help">
              <AlertIcon className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {activeDatabase && activeDatabase.mode !== "r" && (
          <button
            class="btn btn-xs btn-square bg-brand hover:bg-brand/80 text-black border-none shrink-0 shadow-sm hover:shadow-md transition-all"
            type="button"
            title="Create New Record"
            onClick={onNewRecord}
          >
            <PlusIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
