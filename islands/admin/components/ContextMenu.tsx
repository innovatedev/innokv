import { ApiKvKeyPart } from "@/lib/types.ts";
import { Database } from "@/kv/models.ts";
import {
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
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
}: ContextMenuProps) {
  return (
    <div
      class="fixed z-50 bg-base-100 border border-base-300 shadow-lg rounded py-1 min-w-[150px]"
      style={{ top: state.y, left: state.x }}
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
              {activeDatabase &&
                  (activeDatabase.id === state.dbId ||
                    activeDatabase.slug === state.dbId)
                ? "Refresh"
                : "Open"}
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
