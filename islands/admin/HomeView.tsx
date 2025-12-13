import {
  DatabaseIcon,
  FileDatabaseIcon,
  MemoryDatabaseIcon,
  RemoteDatabaseIcon,
} from "../../components/icons/DatabaseIcons.tsx";

import { useContext, useRef } from "preact/hooks";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";
import Dialog from "./Dialog.tsx";
import ConnectDatabaseForm from "./forms/ConnectDatabase.tsx";
import BrandHeader from "../../components/BrandHeader.tsx";

export default function HomeView() {
  const { databases, selectedDatabase, api } = useContext(DatabaseContext);
  const createDatabaseRef = useRef<HTMLDialogElement>(null);

  return (
    <div class="flex flex-col w-full max-w-4xl mx-auto p-4 gap-3">
      <div class="mb-8 mt-12">
        <BrandHeader />
      </div>
      {/* deno-lint-ignore no-explicit-any */}
      {databases.value.map((db: any) => {
        let Icon = <DatabaseIcon className="w-6 h-6" />;

        if (db.type.toLowerCase() === "file") {
          Icon = <FileDatabaseIcon className="w-6 h-6" />;
        } else if (db.type.toLowerCase() === "memory") {
          Icon = <MemoryDatabaseIcon className="w-6 h-6" />;
        } else if (db.type.toLowerCase() === "remote") {
          Icon = <RemoteDatabaseIcon className="w-6 h-6" />;
        }

        return (
          <a
            href={`/${db.slug || db.id}`}
            class="cursor-pointer card card-side bg-base-100 border border-base-200 shadow-sm p-2 items-center gap-4 transition-all hover:bg-base-50 hover:shadow-md hover:border-primary/50 group"
            key={db.id}
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
            </div>
            <div class="flex flex-col items-end gap-2 text-xs text-base-content/50 mt-0.5">
              <div
                class="text-xs text-base-content/40 font-mono hidden sm:block whitespace-nowrap"
                title={`Created: ${
                  db.createdAt
                    ? new Date(db.createdAt).toLocaleDateString()
                    : ""
                }`}
              >
                {db.createdAt
                  ? new Date(db.createdAt).toLocaleDateString()
                  : ""}
              </div>
              {db.lastAccessedAt && (
                <div
                  class="text-xs text-base-content/40 font-mono hidden sm:block whitespace-nowrap"
                  title={`Last Accessed: ${
                    db.lastAccessedAt
                      ? new Date(db.lastAccessedAt).toLocaleDateString()
                      : ""
                  }`}
                >
                  {db.lastAccessedAt
                    ? new Date(db.lastAccessedAt).toLocaleDateString()
                    : ""}
                </div>
              )}
            </div>
            <div class="pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-5 h-5 text-base-content/30"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </div>
          </a>
        );
      })}
      <div
        role="button"
        class="cursor-pointer card card-side bg-base-100/50 border-2 border-dashed border-base-300 p-2 items-center gap-4 hover:border-primary hover:bg-base-100 transition-all group"
        onClick={() => {
          selectedDatabase.value = null;
          createDatabaseRef.current?.showModal();
        }}
      >
        <div class="p-3 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-6 h-6 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </div>
        <span class="font-semibold opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all">
          Connect New Database
        </span>
      </div>

      <Dialog ref={createDatabaseRef} title="Connect Database">
        <ConnectDatabaseForm
          onCancel={() => createDatabaseRef.current?.close()}
          onSubmit={(data, form) => {
            api.createDatabase(data)
              .then(async (db) => {
                selectedDatabase.value = db.id;
                form.reset();
                databases.value = (await api.getDatabases()).data;
                createDatabaseRef.current?.close();
                // Redirect to the new database
                globalThis.location.href = `/${db.id}`;
              });
          }}
        />
      </Dialog>
    </div>
  );
}
