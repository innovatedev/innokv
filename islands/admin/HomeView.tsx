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
        let Icon = (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694-4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
        );

        if (db.type.toLowerCase() === "file") {
          Icon = (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          );
        } else if (db.type.toLowerCase() === "memory") {
          Icon = (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 16.5V21m3.75-18v1.5m0 16.5V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"
              />
            </svg>
          );
        } else if (db.type.toLowerCase() === "remote") {
          Icon = (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
              />
            </svg>
          );
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
