import { useEffect, useRef, useState } from "preact/hooks";
import { AuditLog } from "@/kv/models.ts";
import Dialog from "./Dialog.tsx";
import { KeyDisplay } from "./KeyDisplay.tsx";
import { ValueDisplay } from "./ValueDisplay.tsx";
import { KeyCodec } from "@/lib/KeyCodec.ts";

import { SearchIcon } from "../../components/icons/ActionIcons.tsx";

interface AuditLogsViewProps {
  initialLogs: AuditLog[];
  databases: { id: string; name: string }[];
}

export default function AuditLogsView(
  { initialLogs: propLogs, databases: propDatabases }: AuditLogsViewProps,
) {
  const [logs, setLogs] = useState<AuditLog[]>(propLogs);
  const [databases] = useState(propDatabases);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (selectedLog && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!selectedLog && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [selectedLog]);

  const loadMore = async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?cursor=${nextCursor}`);
      const data = await res.json();
      const mappedLogs = (data.result || []).map((
        l: { id: string; value: Omit<AuditLog, "id"> },
      ) => ({
        id: l.id,
        ...l.value,
      })) as AuditLog[];
      setLogs([...logs, ...mappedLogs]);
      setNextCursor(data.cursor || "");
    } finally {
      setLoading(false);
    }
  };

  const getDatabaseName = (id: string) => {
    return databases.find((db) => db.id === id)?.name || id;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "set":
        return "badge-success";
      case "delete":
        return "badge-error";
      case "move":
        return "badge-info";
      case "copy":
        return "badge-neutral";
      case "import":
        return "badge-warning";
      case "increment":
        return "badge-secondary";
      default:
        return "badge-ghost";
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!appliedSearch) return true;
    const searchLower = appliedSearch.toLowerCase();
    const keyStr = log.key.map((p: Deno.KvKeyPart) => String(p)).join("/")
      .toLowerCase();
    const userStr = (log.userId || "system").toLowerCase();
    const actionStr = log.action.toLowerCase();

    return keyStr.includes(searchLower) ||
      userStr.includes(searchLower) ||
      actionStr.includes(searchLower);
  });

  const onSearch = () => {
    setAppliedSearch(searchQuery);
  };

  const onClearSearch = () => {
    setSearchQuery("");
    setAppliedSearch("");
  };

  return (
    <div>
      <div class="mb-6 flex flex-col md:flex-row gap-4 justify-between items-end">
        <div class="join flex-1 max-w-xl">
          <div
            class={`relative flex-1 group join-item border transition-colors bg-base-100/50 focus-within:bg-base-100 ${
              appliedSearch ? "border-primary" : "border-base-300"
            }`}
          >
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors z-10">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search audit logs..."
              class="w-full h-10 pl-10 pr-10 text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-base-content"
              value={searchQuery}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
                if (e.key === "Escape") onClearSearch();
              }}
            />
            {searchQuery && (
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-circle btn-xs opacity-40 hover:opacity-100"
                onClick={onClearSearch}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            class={`btn btn-sm h-10 join-item px-6 transition-all ${
              appliedSearch ? "btn-primary" : "btn-neutral"
            }`}
            onClick={onSearch}
          >
            Search
          </button>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch("/api/admin/audit-logs");
                const data = await res.json();
                const mappedLogs = (data.result || []).map((
                  l: { id: string; value: Omit<AuditLog, "id"> },
                ) => ({
                  id: l.id,
                  ...l.value,
                })) as AuditLog[];
                setLogs(mappedLogs);
                setNextCursor(data.cursor || "");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            {loading
              ? <span class="loading loading-spinner loading-xs"></span>
              : "Refresh"}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto bg-base-200 rounded-box shadow-xl border border-base-300">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User</th>
              <th>Database</th>
              <th>Key</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} class="hover:bg-base-300 transition-colors">
                <td class="text-xs opacity-70 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td>
                  <span
                    class={`badge badge-sm font-bold uppercase ${
                      getActionColor(log.action)
                    }`}
                  >
                    {log.action}
                  </span>
                </td>
                <td class="text-sm font-medium">
                  {log.userId || (
                    <span class="opacity-50 italic text-xs">
                      System / Unknown
                    </span>
                  )}
                </td>
                <td class="text-sm opacity-70">
                  {getDatabaseName(log.databaseId)}
                </td>
                <td class="max-w-xs truncate">
                  <div class="flex items-center flex-wrap gap-0.5">
                    {log.key.map((partPart: Deno.KvKeyPart, i: number) => {
                      const part = KeyCodec.fromNativePart(partPart);
                      return (
                        <span key={i} class="flex items-center">
                          {i > 0 && <span class="opacity-30 mx-0.5">/</span>}
                          <KeyDisplay type={part.type} value={part.value} />
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost btn-outline"
                    onClick={() =>
                      setSelectedLog(log)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={6} class="text-center py-12 opacity-50 italic">
                  No audit logs found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div class="mt-4 flex justify-center">
          <button
            type="button"
            class="btn btn-sm btn-ghost gap-2 opacity-70 hover:opacity-100"
            onClick={loadMore}
            disabled={loading}
          >
            {loading
              ? <span class="loading loading-spinner loading-xs"></span>
              : "Load More Logs"}
          </button>
        </div>
      )}

      <Dialog ref={dialogRef} title="Audit Log Details">
        {selectedLog && (
          <div class="flex flex-col gap-6">
            <div class="grid grid-cols-2 gap-4 bg-base-300 p-4 rounded-lg">
              <div>
                <span class="text-xs uppercase opacity-50 block mb-1">
                  Timestamp
                </span>
                <span class="text-sm font-bold">
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </span>
              </div>
              <div>
                <span class="text-xs uppercase opacity-50 block mb-1">
                  Action
                </span>
                <span
                  class={`badge badge-sm font-bold uppercase ${
                    getActionColor(selectedLog.action)
                  }`}
                >
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <span class="text-xs uppercase opacity-50 block mb-1">
                  User ID
                </span>
                <span class="text-sm font-mono break-all">
                  {selectedLog.userId || "N/A"}
                </span>
              </div>
              <div>
                <span class="text-xs uppercase opacity-50 block mb-1">
                  Database
                </span>
                <span class="text-sm font-bold">
                  {getDatabaseName(selectedLog.databaseId)}
                </span>
              </div>
            </div>

            <div class="form-control">
              <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">
                Key
              </span>
              <div class="p-3 bg-base-300 rounded border border-base-content/10">
                <div class="flex items-center flex-wrap gap-0.5">
                  {selectedLog.key.map(
                    (partPart: Deno.KvKeyPart, i: number) => {
                      const part = KeyCodec.fromNativePart(partPart);
                      return (
                        <span key={i} class="flex items-center">
                          {i > 0 && <span class="opacity-30 mx-0.5">/</span>}
                          <KeyDisplay type={part.type} value={part.value} />
                        </span>
                      );
                    },
                  )}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">
                  Before
                </span>
                <div class="p-4 bg-base-300 rounded-lg min-h-[100px] flex flex-col">
                  {selectedLog.oldValue
                    ? <ValueDisplay value={selectedLog.oldValue} />
                    : (
                      <span class="text-xs opacity-50 italic m-auto text-center">
                        No previous value
                      </span>
                    )}
                </div>
              </div>

              <div class="form-control">
                <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">
                  After
                </span>
                <div class="p-4 bg-base-300 rounded-lg min-h-[100px] flex flex-col">
                  {selectedLog.newValue
                    ? <ValueDisplay value={selectedLog.newValue} />
                    : (
                      <span class="text-xs opacity-50 italic m-auto text-center">
                        No new value
                      </span>
                    )}
                </div>
              </div>
            </div>

            {selectedLog.details &&
              Object.keys(selectedLog.details).length > 0 && (
              <div class="form-control">
                <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">
                  Additional Details
                </span>
                <pre class="text-xs bg-base-300 p-3 rounded overflow-auto max-h-40 font-mono">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}

            <div class="modal-action mt-2">
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
