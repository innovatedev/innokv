import { useEffect, useRef, useState } from "preact/hooks";
import { AuditLog } from "@/kv/models.ts";
import Dialog from "./Dialog.tsx";
import { KeyDisplay } from "./KeyDisplay.tsx";
import { ValueDisplay } from "./ValueDisplay.tsx";
import { KeyCodec } from "@/lib/KeyCodec.ts";

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
  const [_cursor, _setCursor] = useState<string | null>(null); // TODO: Handle actual pagination
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [search, setSearch] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (selectedLog && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!selectedLog && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [selectedLog]);

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

  const filteredLogs = logs.filter((log) =>
    JSON.stringify(log.key).toLowerCase().includes(search.toLowerCase()) ||
    log.userId?.toLowerCase().includes(search.toLowerCase()) ||
    log.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div class="mb-6 flex flex-col md:flex-row gap-4 justify-between items-end">
        <div class="form-control w-full max-w-md">
          <label class="label pb-1">
            <span class="label-text text-xs opacity-70">Search Logs</span>
          </label>
          <input
            type="text"
            placeholder="Search by key, user, or action..."
            class="input input-bordered w-full"
            value={search}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
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
                // Map documents to values
                const mappedLogs = (data.result || []).map((l: any) => ({ id: l.id, ...l.value }));
                setLogs(mappedLogs);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
           >
             {loading ? <span class="loading loading-spinner loading-xs"></span> : "Refresh"}
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
                  <span class={`badge badge-sm font-bold uppercase ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td class="text-sm font-medium">
                  {log.userId || <span class="opacity-50 italic text-xs">System / Unknown</span>}
                </td>
                <td class="text-sm opacity-70">
                  {getDatabaseName(log.databaseId)}
                </td>
                <td class="max-w-xs truncate">
                  <div class="flex items-center flex-wrap gap-0.5">
                    {log.key.map((partPart: any, i: number) => {
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
                    onClick={() => setSelectedLog(log)}
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

      <Dialog ref={dialogRef} title="Audit Log Details">
        {selectedLog && (
          <div class="flex flex-col gap-6">
            <div class="grid grid-cols-2 gap-4 bg-base-300 p-4 rounded-lg">
               <div>
                 <span class="text-xs uppercase opacity-50 block mb-1">Timestamp</span>
                 <span class="text-sm font-bold">{new Date(selectedLog.timestamp).toLocaleString()}</span>
               </div>
               <div>
                 <span class="text-xs uppercase opacity-50 block mb-1">Action</span>
                 <span class={`badge badge-sm font-bold uppercase ${getActionColor(selectedLog.action)}`}>
                   {selectedLog.action}
                 </span>
               </div>
               <div>
                 <span class="text-xs uppercase opacity-50 block mb-1">User ID</span>
                 <span class="text-sm font-mono break-all">{selectedLog.userId || "N/A"}</span>
               </div>
               <div>
                 <span class="text-xs uppercase opacity-50 block mb-1">Database</span>
                 <span class="text-sm font-bold">{getDatabaseName(selectedLog.databaseId)}</span>
               </div>
            </div>

            <div class="form-control">
              <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">Key</span>
              <div class="p-3 bg-base-300 rounded border border-base-content/10">
                <div class="flex items-center flex-wrap gap-0.5">
                  {selectedLog.key.map((partPart: any, i: number) => {
                    const part = KeyCodec.fromNativePart(partPart);
                    return (
                      <span key={i} class="flex items-center">
                        {i > 0 && <span class="opacity-30 mx-0.5">/</span>}
                        <KeyDisplay type={part.type} value={part.value} />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">Before</span>
                <div class="p-4 bg-base-300 rounded-lg min-h-[100px] flex flex-col">
                  {selectedLog.oldValue ? (
                    <ValueDisplay value={selectedLog.oldValue} />
                  ) : (
                    <span class="text-xs opacity-50 italic m-auto text-center">No previous value</span>
                  )}
                </div>
              </div>

              <div class="form-control">
                <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">After</span>
                <div class="p-4 bg-base-300 rounded-lg min-h-[100px] flex flex-col">
                  {selectedLog.newValue ? (
                    <ValueDisplay value={selectedLog.newValue} />
                  ) : (
                    <span class="text-xs opacity-50 italic m-auto text-center">No new value</span>
                  )}
                </div>
              </div>
            </div>

            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div class="form-control">
                <span class="label-text font-bold mb-2 uppercase text-xs opacity-70">Additional Details</span>
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
