import { ApiKvKeyPart } from "@/lib/types.ts";
import { Database } from "@/kv/models.ts";
import {
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  InfoIcon,
  RefreshIcon,
} from "../../../components/icons/ActionIcons.tsx";

export interface ContextMenuState {
  x: number;
  y: number;
  type: "folder" | "item" | "database";
  path: ApiKvKeyPart[];
  dbId?: string;
}

interface ContextMenuProps {
  state: ContextMenuState;
  activeDatabase: Database | null;
  databases: Database[];
  onRefresh: () => void;
  onEditDatabase: (dbId: string) => void;
  onDuplicate: (path: ApiKvKeyPart[]) => void;
  onMove: (path: ApiKvKeyPart[]) => void;
  onDeletePath: (path: ApiKvKeyPart[]) => void;
  onRefreshPath: (path: ApiKvKeyPart[]) => void;
  onViewStats: (dbId: string, path?: ApiKvKeyPart[]) => void;
}

export function ContextMenu({
  state,
  activeDatabase,
  databases,
  onRefresh,
  onEditDatabase,
  onDuplicate,
  onMove,
  onDeletePath,
  onRefreshPath,
  onViewStats,
}: ContextMenuProps) {
  return (
    <div
      // High z-index is required to appear above breadcrumb dropdowns (z-50) and other overlays
      class="fixed z-1000 bg-base-100 border border-base-200 shadow-xl rounded-lg py-1 min-w-[180px] backdrop-blur-sm"
      style={{ top: state.y + 2, left: state.x + 2 }}
    >
      {state.type === "database"
        ? (
          <>
            <button
              type="button"
              class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
              onClick={() => {
                if (state.dbId) {
                  onRefresh();
                }
              }}
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
              onClick={() => {
                if (state.dbId) {
                  onViewStats(state.dbId, []);
                }
              }}
            >
              <InfoIcon className="w-4 h-4" />
              View Database Stats
            </button>
            <button
              type="button"
              class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
              onClick={() => {
                if (state.dbId) {
                  onEditDatabase(state.dbId);
                }
              }}
            >
              <EditIcon className="w-4 h-4" />
              Edit Database Config
            </button>
          </>
        )
        : (
          <>
            <button
              type="button"
              class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
              onClick={() => {
                const dbId = activeDatabase?.slug || activeDatabase?.id;
                if (dbId) {
                  onViewStats(dbId, state.path);
                }
              }}
            >
              <InfoIcon className="w-4 h-4" />
              View Stats
            </button>
            <button
              type="button"
              class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
              onClick={() => onRefreshPath(state.path)}
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </button>
            {databases.some((d) => d.mode !== "r") && (
              <button
                type="button"
                class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
                onClick={() => onDuplicate(state.path)}
              >
                <DuplicateIcon className="w-4 h-4" />
                Duplicate
              </button>
            )}
            {activeDatabase?.mode !== "r" && (
              <>
                <button
                  type="button"
                  class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm flex items-center gap-2"
                  onClick={() => onMove(state.path)}
                >
                  <EditIcon className="w-4 h-4" />
                  Move / Rename
                </button>
                <button
                  type="button"
                  class="w-full text-left px-4 py-2 hover:bg-base-200 text-sm text-error flex items-center gap-2"
                  onClick={() => onDeletePath(state.path)}
                >
                  <DeleteIcon className="w-4 h-4" />
                  Delete Path
                </button>
              </>
            )}
          </>
        )}
    </div>
  );
}
