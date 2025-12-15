import {
  DatabaseIcon,
  FileDatabaseIcon,
  MemoryDatabaseIcon,
  RemoteDatabaseIcon,
} from "../../components/icons/DatabaseIcons.tsx";
import {
  EditIcon,
  PinIcon,
  PlusIcon,
  UnpinIcon,
} from "../../components/icons/ActionIcons.tsx";

import { useContext, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";
import Dialog from "./Dialog.tsx";
import ConnectDatabaseForm from "./forms/ConnectDatabase.tsx";
import BrandHeader from "../../components/BrandHeader.tsx";

export default function HomeView(
  { successMessage }: { successMessage?: string },
) {
  const { databases, selectedDatabase, api } = useContext(DatabaseContext);
  const createDatabaseRef = useRef<HTMLDialogElement>(null);
  const editingDatabase = useSignal<any>(null);

  return (
    <>
      {/* Pinned Databases Section */}
      {databases.value.some((db: any) => db.sort > 0) && (
        <div class="mb-6">
          <h2 class="text-sm font-bold uppercase tracking-wider opacity-50 mb-3">
            Pinned
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {databases.value
              .filter((db: any) => db.sort > 0)
              .sort((a: any, b: any) => b.sort - a.sort)
              .slice(0, 5)
              .map((db: any) => (
                <div key={db.id} class="relative group">
                  <a
                    href={`/${db.slug || db.id}`}
                    class={`block card bg-base-100 border shadow-sm p-3 hover:shadow-md transition-all h-full ${
                      db.lastError
                        ? "border-error hover:border-error"
                        : "border-base-200 hover:border-primary/50"
                    }`}
                  >
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-base-200 rounded-lg text-primary shrink-0">
                        {db.type === "file"
                          ? <FileDatabaseIcon className="w-5 h-5" />
                          : db.type === "memory"
                          ? <MemoryDatabaseIcon className="w-5 h-5" />
                          : db.type === "remote"
                          ? <RemoteDatabaseIcon className="w-5 h-5" />
                          : <DatabaseIcon className="w-5 h-5" />}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="font-bold truncate text-sm">{db.name}</div>
                        {db.description && (
                          <div class="text-xs text-base-content/60 truncate">
                            {db.description}
                          </div>
                        )}
                        {db.lastError && (
                          <div
                            class="text-xs text-error font-semibold truncate mt-1"
                            title={db.lastError}
                          >
                            ! {db.lastError}
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                  {/* Unpin Button */}
                  <button
                    type="button"
                    class="absolute top-2 right-2 btn btn-xs btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-opacity bg-base-100 shadow-sm"
                    title="Unpin"
                    onClick={(e) => {
                      e.preventDefault();
                      api.updateDatabase({ id: db.id, sort: 0 }).then(() => {
                        // Refresh
                        api.getDatabases().then((res) =>
                          databases.value = res.data
                        );
                      });
                    }}
                  >
                    <UnpinIcon className="w-3 h-3 text-base-content/50 hover:text-error" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Database List */}
      <h2 class="text-sm font-bold uppercase tracking-wider opacity-50 mb-3">
        All Databases
      </h2>
      {databases.value
        .filter((db: any) => !db.sort || db.sort <= 0)
        .map((db: any) => {
          let Icon = <DatabaseIcon className="w-6 h-6" />;

          if (db.type.toLowerCase() === "file") {
            Icon = <FileDatabaseIcon className="w-6 h-6" />;
          } else if (db.type.toLowerCase() === "memory") {
            Icon = <MemoryDatabaseIcon className="w-6 h-6" />;
          } else if (db.type.toLowerCase() === "remote") {
            Icon = <RemoteDatabaseIcon className="w-6 h-6" />;
          }

          return (
            <div key={db.id} class="relative group">
              <a
                href={`/${db.slug || db.id}`}
                class={`cursor-pointer card card-side bg-base-100 border shadow-sm p-2 items-center gap-4 transition-all hover:bg-base-50 hover:shadow-md group ${
                  db.lastError
                    ? "border-error hover:border-error"
                    : "border-base-200 hover:border-primary/50"
                }`}
              >
                <div class="p-3 bg-base-200 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {Icon}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <div class="font-bold whitespace-nowrap truncate">
                      {db.name}
                    </div>
                    {db.mode === "ro" && (
                      <div class="badge badge-xs badge-warning variant-soft uppercase font-bold tracking-wider">
                        Read Only
                      </div>
                    )}
                  </div>
                  <div class="flex items-center gap-2 text-xs text-base-content/50 mt-0.5">
                    <span class="font-mono bg-base-200 px-1 rounded">
                      {db.type}
                    </span>
                    {db.description && (
                      <span class="truncate opacity-70 border-l border-base-content/20 pl-2">
                        {db.description}
                      </span>
                    )}
                  </div>
                  {db.lastError && (
                    <div
                      class="text-xs text-error font-semibold truncate mt-1"
                      title={db.lastError}
                    >
                      ! {db.lastError}
                    </div>
                  )}
                </div>
                <div class="flex flex-col items-end gap-2 text-xs text-base-content/50 mt-0.5 mr-8">
                  {/* Date removed to prevent overlap */}
                </div>
              </a>
              <div class="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-circle"
                  title="Edit Database"
                  onClick={(e) => {
                    e.preventDefault();
                    editingDatabase.value = db;
                    createDatabaseRef.current?.showModal();
                  }}
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-circle"
                  title="Pin to top"
                  onClick={(e) => {
                    e.preventDefault();
                    // Pin with current timestamp to put at top
                    api.updateDatabase({ id: db.id, sort: Date.now() }).then(
                      () => {
                        api.getDatabases().then((res) =>
                          databases.value = res.data
                        );
                      },
                    );
                  }}
                >
                  <PinIcon className="w-4 h-4 -rotate-45" />
                </button>
              </div>
            </div>
          );
        })}
      <div
        role="button"
        class="cursor-pointer card card-side bg-base-100/50 border-2 border-dashed border-base-300 p-2 items-center gap-4 hover:border-primary hover:bg-base-100 transition-all group"
        onClick={() => {
          selectedDatabase.value = null;
          editingDatabase.value = null;
          createDatabaseRef.current?.showModal();
        }}
      >
        <div class="p-3 flex items-center justify-center">
          <PlusIcon className="w-6 h-6 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
        </div>
        <span class="font-semibold opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all">
          Connect New Database
        </span>
      </div>

      <Dialog
        ref={createDatabaseRef}
        title={editingDatabase.value ? "Edit Database" : "Connect Database"}
      >
        <ConnectDatabaseForm
          database={editingDatabase.value}
          onCancel={() => createDatabaseRef.current?.close()}
          onSubmit={(data, form) => {
            if (editingDatabase.value) {
              // Update existing
              api.updateDatabase({ ...data, id: editingDatabase.value.id })
                .then(() => {
                  api.getDatabases().then((res) => databases.value = res.data);
                  createDatabaseRef.current?.close();
                  form.reset();
                  editingDatabase.value = null;
                });
            } else {
              // Create new
              api.createDatabase(data)
                .then(async (db) => {
                  selectedDatabase.value = db.id;
                  form.reset();
                  databases.value = (await api.getDatabases()).data;
                  createDatabaseRef.current?.close();
                  globalThis.location.href = `/${db.slug || db.id}`;
                });
            }
          }}
        />
      </Dialog>
    </>
  );
}
