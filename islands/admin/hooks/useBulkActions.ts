import { Signal, useSignal } from "@preact/signals";
import { ApiKvEntry, ApiKvKeyPart, DbNode, SearchResult } from "@/lib/types.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { Database } from "@/kv/models.ts";
import KvAdminClient from "@/lib/KvAdminClient.ts";

export function useBulkActions(
  activeDatabase: Database | null,
  selectedDatabase: Signal<string | null>,
  api: KvAdminClient,
  pathInfo: Signal<ApiKvKeyPart[] | null>,
  records: Signal<ApiKvEntry[]>,
  nextCursor: Signal<string | undefined>,
  cursor: Signal<string | undefined>,
  limit: Signal<number>,
  isSearchActive: Signal<boolean>,
  searchResults: Signal<SearchResult[]>,
  handleSearch: () => Promise<void>,
  setDbStructure: (structure: Record<string, DbNode> | null) => void,
) {
  const selectedKeys = useSignal<Set<string>>(new Set());
  const selectAllMatching = useSignal(false);

  const handleBulkDelete = async () => {
    if (
      !activeDatabase || (!selectedKeys.value.size && !selectAllMatching.value)
    ) return;
    if (activeDatabase.mode === "r") {
      alert("Database is read-only");
      return;
    }

    const selectionCount = selectAllMatching.value
      ? "All"
      : selectedKeys.value.size;
    const isAll = selectAllMatching.value;
    const msg = isAll
      ? (isSearchActive.value
        ? "Delete all matching search results?"
        : "Delete all records at this level?")
      : `Are you sure you want to delete ${selectionCount} records? This cannot be undone.`;

    if (!confirm(msg)) return;

    try {
      const dbId = activeDatabase.slug || activeDatabase.id;
      if (selectAllMatching.value) {
        if (isSearchActive.value) {
          const keys = searchResults.value.map((r) => r.key);
          await api.deleteRecords(dbId, { keys });
        } else {
          await api.deleteRecords(dbId, {
            all: true,
            pathInfo: KeyCodec.encode(pathInfo.value || []),
            recursive: false,
          });
        }
      } else {
        const keys = Array.from(selectedKeys.value).map((k) =>
          KeyCodec.decode(k)
        );
        await api.deleteRecords(dbId, { keys });
      }

      selectedKeys.value = new Set();
      selectAllMatching.value = false;

      if (isSearchActive.value) {
        handleSearch();
      } else {
        const target = activeDatabase?.slug || selectedDatabase.value;
        if (target && pathInfo.value) {
          api.getRecords(target, pathInfo.value, cursor.value, limit.value, {
            recursive: false,
          }).then((res: { records: ApiKvEntry[]; cursor?: string }) => {
            records.value = res.records;
            nextCursor.value = res.cursor;
          });
        }
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExport = async (recursive = true) => {
    if (!activeDatabase) return;
    const dbId = activeDatabase.slug || activeDatabase.id;

    try {
      let data;
      let fileName = `${dbId}`;

      if (selectAllMatching.value) {
        if (isSearchActive.value) {
          const keys = searchResults.value.map((r) => r.key);
          data = await api.exportRecords(dbId, { keys });
          fileName += "-search-results.json";
        } else {
          data = await api.exportRecords(dbId, {
            pathInfo: KeyCodec.encode(pathInfo.value || []),
            recursive: true,
            all: true,
          });
          fileName += "-all-matching.json";
        }
      } else if (selectedKeys.value.size > 0) {
        const keys = Array.from(selectedKeys.value).map((k) =>
          KeyCodec.decode(k)
        );
        data = await api.exportRecords(dbId, { keys });
        fileName += `-selected-${selectedKeys.value.size}.json`;
      } else {
        const path = pathInfo.value || [];
        const pathStr = KeyCodec.encode(path);
        data = await api.exportRecords(dbId, {
          pathInfo: pathStr,
          recursive,
        });
        fileName += `-${
          path.length > 0 ? path.map((p) => p.value).join("_") : "root"
        }.json`;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImport = () => {
    if (!activeDatabase) return;
    const dbId = activeDatabase.slug || activeDatabase.id;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (re: ProgressEvent<FileReader>) => {
        try {
          const result = re.target?.result as string;
          const data = JSON.parse(result);
          if (!Array.isArray(data)) throw new Error("Invalid format");

          api.importRecords(dbId, data).then(
            (res: { importedCount: number }) => {
              alert(`Imported ${res.importedCount} records`);
              const dbTarget = activeDatabase?.slug || selectedDatabase.value;
              if (pathInfo.value && dbTarget) {
                api.getRecords(
                  dbTarget,
                  pathInfo.value,
                  cursor.value,
                  limit.value,
                  {
                    recursive: false,
                  },
                ).then((res: { records: ApiKvEntry[]; cursor?: string }) => {
                  records.value = res.records;
                  nextCursor.value = res.cursor;
                });
              }
              api.getDatabase(dbId).then((s: Record<string, DbNode>) =>
                setDbStructure(s)
              );
            },
          );
        } catch (err: unknown) {
          alert(
            `Import failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return {
    selectedKeys,
    selectAllMatching,
    handleBulkDelete,
    handleExport,
    handleImport,
  };
}
