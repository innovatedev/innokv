import { ApiKvEntry, ApiKvKeyPart, SearchResult } from "@/lib/types.ts";
import { RichValue } from "@/lib/ValueCodec.ts";
import RecordItem from "./RecordItem.tsx";
import { KeyCodec } from "@/lib/KeyCodec.ts";

interface SearchResultsProps {
  databaseId: string;
  results: SearchResult[];
  prettyPrintDates: boolean;
  isReadOnly: boolean;
  onEditRecord: (record: ApiKvEntry<RichValue>) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  selectedKeys: Set<string>;
  onToggleSelection: (key: ApiKvKeyPart[]) => void;
  onIncrement?: (key: ApiKvKeyPart[], amount: bigint) => void;
}

export default function SearchResults(
  {
    results,
    prettyPrintDates,
    isReadOnly,
    onEditRecord,
    isLoading,
    hasMore,
    onLoadMore,
    selectedKeys,
    onToggleSelection,
    onIncrement,
  }: SearchResultsProps,
) {
  if (results.length === 0 && !isLoading) {
    return (
      <div class="flex flex-col items-center justify-center py-12 text-base-content/40">
        <p>No results found matching your query.</p>
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-2">
      {results.map((result) => {
        const record: ApiKvEntry<RichValue> = {
          key: result.key,
          value: result.value as RichValue,
          versionstamp: result.versionstamp,
        };
        const keyStr = KeyCodec.encode(result.key);

        return (
          <div key={keyStr} class="relative">
            <RecordItem
              record={record}
              selected={selectedKeys.has(keyStr)}
              onToggleSelection={onToggleSelection}
              prettyPrintDates={prettyPrintDates}
              onEdit={() => onEditRecord(record)}
              onIncrement={(amount) => onIncrement?.(result.key, amount)}
              isReadOnly={isReadOnly}
            />
          </div>
        );
      })}

      {hasMore && (
        <div class="flex justify-center py-4">
          <button
            type="button"
            class={`btn btn-ghost btn-sm ${isLoading ? "loading" : ""}`}
            onClick={onLoadMore}
            disabled={isLoading}
          >
            Load More Results
          </button>
        </div>
      )}

      {isLoading && results.length === 0 && (
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}
    </div>
  );
}
