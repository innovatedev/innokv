import { KeyCodec } from "@/codec/mod.ts";
import { Database } from "@/kv/models.ts";
import {
  InfoIcon,
  RefreshIcon,
} from "../../../components/icons/ActionIcons.tsx";
import { formatSize } from "@/lib/utils.ts";
import { ApiKvKeyPart } from "@/lib/types.ts";
import { useEffect, useState } from "preact/hooks";

import { KeyDisplay } from "../KeyDisplay.tsx";

interface DatabaseStatsViewProps {
  database: Database;
  path?: ApiKvKeyPart[];
  onRefreshStats: (
    id: string,
    path?: ApiKvKeyPart[],
    data?: Database["stats"],
  ) => Promise<void>;
}

export function DatabaseStatsView({
  database,
  path,
  onRefreshStats,
}: DatabaseStatsViewProps) {
  const [localStats, setLocalStats] = useState<Database["stats"]>(
    (path && path.length > 0 ? null : database.stats) as Database["stats"],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"size" | "count">("size");

  // Run initial scan exactly once when the modal opens for this specific target
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        if (path && path.length > 0) {
          const res = await fetch(`/api/admin/databases/${database.id}/stats`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pathInfo: KeyCodec.encode(path) }),
          });
          const data = await res.json();
          if (data.ok) {
            setLocalStats(data.stats);
            setError(null);
          } else {
            setError(data.error);
          }
        } else {
          const res = await fetch(`/api/admin/databases/${database.id}/stats`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const data = await res.json();
          if (data.ok) {
            setLocalStats(data.stats);
            setError(null);
            // Just notify context that we have new stats (don't re-trigger scan)
            onRefreshStats(database.id, undefined, data.stats);
          } else {
            setError(data.error);
          }
        }
      } catch (e) {
        console.error(e);
        setError("Network error occurred while fetching statistics.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const stats = localStats;
  const topNodes = (stats?.topChildren || []) as Array<{
    key: ApiKvKeyPart;
    size: number;
    count: number;
  }>;
  const sortedNodes = [...topNodes].sort((a, b) =>
    sortBy === "size" ? b.size - a.size : b.count - a.count
  );

  return (
    <div class="flex flex-col gap-4">
      {error && (
        <div class="alert alert-error alert-outline text-xs py-2 shadow-sm border-error/50">
          <InfoIcon className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      {stats?.isPartial && (
        <div class="alert alert-warning alert-outline text-xs py-2 shadow-sm border-warning/50">
          <InfoIcon className="w-4 h-4" />
          <span>
            <strong>Partial Scan:</strong>{" "}
            This database is very large and the scan timed out. Data shown is
            incomplete.
          </span>
        </div>
      )}
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-base-200/50 p-3 rounded-lg border border-base-300 shadow-sm">
          <span class="text-xs opacity-60 uppercase font-bold block mb-1">
            Records
          </span>
          <span class="text-2xl font-mono font-black text-primary">
            {stats?.recordCount?.toLocaleString() ?? "---"}
          </span>
        </div>
        <div class="bg-base-200/50 p-3 rounded-lg border border-base-300 shadow-sm">
          <span class="text-xs opacity-60 uppercase font-bold block mb-1">
            Total Size
          </span>
          <span class="text-2xl font-mono font-black text-primary">
            {stats ? formatSize(stats.sizeBytes) : "---"}
          </span>
        </div>
      </div>

      {stats?.breakdown && (
        <div class="flex flex-col gap-3">
          <div class="divider my-0 opacity-10"></div>
          <h4 class="text-xs font-bold opacity-50 px-1 uppercase tracking-wider">
            Value Type Distribution
          </h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(stats.breakdown as Record<string, number>).map((
              [key, count],
            ) => (
              <div
                key={key}
                class="bg-base-200/50 p-2.5 rounded-lg flex flex-col items-center justify-center border border-base-300/50 shadow-sm"
              >
                <span class="text-[10px] opacity-60 uppercase font-medium">
                  {key.replace("_", " ")}
                </span>
                <span class="text-base font-mono font-bold text-secondary">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedNodes.length > 0 && (
        <div class="flex flex-col gap-3">
          <div class="divider my-0 opacity-10"></div>
          <div class="flex items-center justify-between px-1">
            <h4 class="text-xs font-bold opacity-50 uppercase tracking-wider">
              Prefix Analysis
            </h4>
            <div class="flex bg-base-300 rounded-lg p-0.5">
              <button
                type="button"
                class={`text-[10px] px-2 py-0.5 rounded ${
                  sortBy === "size"
                    ? "bg-base-100 shadow-sm font-bold"
                    : "opacity-50"
                }`}
                onClick={() => setSortBy("size")}
              >
                Size
              </button>
              <button
                type="button"
                class={`text-[10px] px-2 py-0.5 rounded ${
                  sortBy === "count"
                    ? "bg-base-100 shadow-sm font-bold"
                    : "opacity-50"
                }`}
                onClick={() => setSortBy("count")}
              >
                Count
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {sortedNodes.map((node, idx) => (
              <div
                key={idx}
                class="bg-base-200/40 border border-base-300/50 rounded-lg p-2 flex items-center justify-between group hover:bg-base-200/60 transition-colors"
              >
                <div class="flex items-center gap-2 overflow-hidden mr-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                  <div class="truncate text-xs font-mono opacity-80">
                    <KeyDisplay type={node.key.type} value={node.key.value} />
                  </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <div class="flex flex-col items-end">
                    <span class="text-[10px] font-bold text-secondary">
                      {formatSize(node.size)}
                    </span>
                    <span class="text-[9px] opacity-40 uppercase">
                      {node.count} recs
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="divider my-0 opacity-10"></div>

      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline gap-2 font-bold w-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!path || path.length === 0) {
              // Trigger the effect by just calling a refresh helper
              const fetchRootStats = async () => {
                setLoading(true);
                setError(null);
                try {
                  const res = await fetch(
                    `/api/admin/databases/${database.id}/stats`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                    },
                  );
                  const data = await res.json();
                  if (data.ok) {
                    setLocalStats(data.stats);
                    setError(null);
                    onRefreshStats(database.id, undefined, data.stats);
                  } else {
                    setError(data.error);
                  }
                } catch (e) {
                  console.error(e);
                  setError("Network error occurred while fetching statistics.");
                } finally {
                  setLoading(false);
                }
              };
              fetchRootStats();
            } else {
              // The effect will handle it on re-render if we change something,
              // but for manual refresh button:
              const fetchPathStats = async () => {
                setLoading(true);
                setError(null);
                try {
                  const res = await fetch(
                    `/api/admin/databases/${database.id}/stats`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ pathInfo: KeyCodec.encode(path) }),
                    },
                  );
                  const data = await res.json();
                  if (data.ok) {
                    setLocalStats(data.stats);
                    setError(null);
                  }
                } catch (e) {
                  console.error(e);
                } finally {
                  setLoading(false);
                }
              };
              fetchPathStats();
            }
          }}
          disabled={loading}
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading
            ? "Scanning..."
            : `Refresh ${
              path && path.length > 0 ? "Node" : "Database"
            } Statistics`}
        </button>
        <div class="flex items-center gap-2 justify-center text-[10px] opacity-40 italic">
          <InfoIcon className="w-3 h-3" />
          Last updated: {stats?.updatedAt
            ? new Date(stats.updatedAt).toLocaleString()
            : "Never"}
        </div>
      </div>
    </div>
  );
}
