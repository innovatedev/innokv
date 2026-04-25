import { useContext } from "preact/hooks";
import { Signal } from "@preact/signals";
import { Database } from "@/kv/models.ts";
import { ApiKvEntry, ApiKvKeyPart, DbNode, SearchResult } from "@/lib/types.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { RichValue } from "@/lib/ValueCodec.ts";
import RecordItem from "./RecordItem.tsx";
import SearchResults from "./SearchResults.tsx";
import { ExpandIcon } from "../../components/icons/ExpandIcon.tsx";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";

interface RecordsViewProps {
  isSearchActive: Signal<boolean>;
  searchResults: Signal<SearchResult[]>;
  records: Signal<ApiKvEntry[]>;
  activeDatabase: Database | null;
  allVisibleSelected: boolean;
  selectedKeys: Signal<Set<string>>;
  selectAllMatching: Signal<boolean>;
  searchLoading: Signal<boolean>;
  searchHasMore: Signal<boolean>;
  limit: Signal<number>;
  cursorStack: Signal<(string | undefined)[]>;
  cursor: Signal<string | undefined>;
  nextCursor: Signal<string | undefined>;
  pathInfo: Signal<ApiKvKeyPart[] | null>;
  gonePaths: Signal<Set<string>>;
  dbStructure: Record<string, DbNode> | null;
  onEditRecord: (record: ApiKvEntry<RichValue>) => void;
  onLoadMoreSearch: () => void;
  onToggleSelection: (key: ApiKvKeyPart[]) => void;
  onToggleExpandAll: () => void;
  onToggleSelectVisible: () => void;
  onCreateRecord: () => void;
}

export default function RecordsView(
  {
    isSearchActive,
    searchResults,
    records,
    activeDatabase,
    allVisibleSelected,
    selectedKeys,
    selectAllMatching,
    searchLoading,
    searchHasMore,
    limit,
    cursorStack,
    cursor,
    nextCursor,
    pathInfo,
    gonePaths,
    dbStructure,
    onEditRecord,
    onLoadMoreSearch,
    onToggleSelection,
    onToggleExpandAll,
    onToggleSelectVisible,
    onCreateRecord,
  }: RecordsViewProps,
) {
  const { forceExpandValues } = useContext(DatabaseContext);
  const currentKeyStrings = isSearchActive.value
    ? searchResults.value.map((r) => KeyCodec.encode(r.key))
    : records.value.map((r) => KeyCodec.encode(r.key));

  return (
    <div class="flex-1 overflow-y-auto p-4 content-start">
      {activeDatabase && currentKeyStrings.length > 0 && (
        <div class="bg-base-100 p-2 flex items-center lg:gap-4 gap-2 justify-between mb-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
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
              onClick={onToggleSelectVisible}
            />
            <span class="text-xs font-bold opacity-50">
              Select All
            </span>
          </label>

          <button
            type="button"
            class="btn btn-xs btn-ghost gap-1"
            onClick={onToggleExpandAll}
          >
            <ExpandIcon class={`w-4 h-4 transition-transform duration-200 ${forceExpandValues.value === true ? "rotate-90" : ""}`} />
            <span class="text-xs opacity-70 font-normal">
              {forceExpandValues.value === true ? "Collapse All Values" : "Expand All Values"}
            </span>
          </button>
        </div>
      )}

      {isSearchActive.value
        ? (
          <SearchResults
            databaseId={activeDatabase?.slug || activeDatabase?.id || ""}
            results={searchResults.value}
            prettyPrintDates={activeDatabase?.settings?.prettyPrintDates ??
              true}
            isReadOnly={activeDatabase?.mode === "r"}
            onEditRecord={onEditRecord}
            isLoading={searchLoading.value}
            hasMore={searchHasMore.value}
            onLoadMore={onLoadMoreSearch}
            selectedKeys={selectedKeys.value}
            onToggleSelection={onToggleSelection}
          />
        )
        : (
          <div>
            {records.value.length
              ? (
                <div class="flex flex-col w-full gap-2">
                  {records.value.map((entry) => (
                    <RecordItem
                      key={KeyCodec.encode(entry.key)}
                      record={entry as ApiKvEntry<RichValue>}
                      selected={selectAllMatching.value ||
                        selectedKeys.value.has(
                          KeyCodec.encode(entry.key),
                        )}
                      onToggleSelection={() => onToggleSelection(entry.key)}
                      prettyPrintDates={activeDatabase?.settings
                        ?.prettyPrintDates ??
                        true}
                      onEdit={() =>
                        onEditRecord(entry as ApiKvEntry<RichValue>)}
                      isReadOnly={activeDatabase?.mode === "r"}
                    />
                  ))}

                  <div class="bg-base-100 p-2 flex items-center justify-between gap-2">
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

                    <div class="flex items-center gap-4">
                      <span class="text-xs opacity-50">
                        {records.value.length} items
                      </span>
                      <div class="join join-horizontal">
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
                </div>
              )
              : (
                <div class="p-10 text-center text-base-content/50">
                  {(() => {
                    let hasKnownChildren = false;
                    if (dbStructure) {
                      const currentPath = pathInfo.value || [];
                      if (currentPath.length === 0) {
                        hasKnownChildren = Object.keys(dbStructure).length > 0;
                      } else {
                        let current = dbStructure;
                        let found = true;
                        for (const part of currentPath) {
                          const match = Object.values(current).find((
                            c,
                          ) => c.value === part.value && c.type === part.type);
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
                      gonePaths.value.has(
                        KeyCodec.encode(pathInfo.value),
                      ) &&
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
                    if (activeDatabase) {
                      return (
                        <div class="flex flex-col items-center gap-4 py-10">
                          <p class="text-sm">No records found</p>
                          {activeDatabase.mode !== "r" && (
                            <button
                              type="button"
                              class="btn btn-brand btn-sm"
                              onClick={onCreateRecord}
                            >
                              Create your first record
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <p class="text-sm">
                        Select a database to view records
                      </p>
                    );
                  })()}
                </div>
              )}
          </div>
        )}
    </div>
  );
}
