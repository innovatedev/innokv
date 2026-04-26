import { KeyCodec } from "@/codec/mod.ts";
import { useSignal } from "@preact/signals";
import { useContext } from "preact/hooks";
import { DatabaseContext } from "../contexts/DatabaseContext.tsx";
import { SearchResult } from "@/lib/types.ts";

export function useKvSearch() {
  const {
    activeDatabase,
    pathInfo,
    searchQuery,
    isSearchActive,
    searchTarget,
    searchRegex,
    searchCaseSensitive,
  } = useContext(DatabaseContext);
  const searchResults = useSignal<SearchResult[]>([]);
  const searchLoading = useSignal(false);
  const searchCursor = useSignal<string | undefined>(undefined);
  const searchHasMore = useSignal(false);
  const handleSearch = async (newCursor?: string) => {
    const dbId = activeDatabase?.slug || activeDatabase?.id;
    if (!dbId || !searchQuery.value) return;
    searchLoading.value = true;
    if (!newCursor) {
      searchResults.value = [];
      searchCursor.value = undefined;
    }
    try {
      const params = new URLSearchParams({
        id: dbId,
        query: searchQuery.value,
        target: searchTarget.value,
        regex: String(searchRegex.value),
        caseSensitive: String(searchCaseSensitive.value),
        pathInfo: KeyCodec.encode(pathInfo.value || []),
      });
      if (newCursor) params.set("cursor", newCursor);
      const res = await fetch(`/api/database/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (newCursor) {
        searchResults.value = [...searchResults.value, ...data.results];
      } else {
        searchResults.value = data.results;
      }
      searchCursor.value = data.cursor;
      searchHasMore.value = !!data.cursor;
    } catch (err) {
      console.error(err);
    } finally {
      searchLoading.value = false;
    }
  };
  const clearSearch = () => {
    searchQuery.value = "";
    isSearchActive.value = false;
    searchResults.value = [];
    searchCursor.value = undefined;
    searchHasMore.value = false;
  };
  return {
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
  };
}
