import { useContext, useRef, useState } from "preact/hooks";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";
import ConnectDatabaseForm from "./forms/ConnectDatabase.tsx";
import Dialog from "./Dialog.tsx";

export default function DatabasesMenu() {
  const { databases, selectedDatabase, api, activeDatabase } = useContext(
    DatabaseContext,
  );
  const createDatabaseRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <ul class="menu menu-compact w-full grow">
        {databases.value.map((db) => (
          <li
            key={db.id}
            class={`flex flex-row justify-between ${
              selectedDatabase.value === db.id ? "bg-base-300" : ""
            }`}
          >
            <button
              class="flex-1"
              type="button"
              onClick={(e) => {
                selectedDatabase.value = db.id;
              }}
            >
              <span class="tooltip tooltip-bottom" data-tip={db.slug}>
                {db.name}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                selectedDatabase.value = db.id;
                createDatabaseRef.current?.showModal();
              }}
            >
              edit
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => {
              selectedDatabase.value = null;
              createDatabaseRef.current?.showModal();
            }}
          >
            Connect...
          </button>
        </li>
      </ul>
      <Dialog
        ref={createDatabaseRef}
        title={activeDatabase ? "Edit Database" : "Connect Database"}
      >
        <ConnectDatabaseForm
          onCancel={() => createDatabaseRef.current?.close()}
          onDelete={() => {
            api.deleteDatabase(activeDatabase!.id)
              .then(async (db) => {
                console.log("Database deleted", activeDatabase);

                databases.value = (await api.getDatabases()).data;
                selectedDatabase.value = null;
                createDatabaseRef.current?.close();
              });
          }}
          onSubmit={(data, form) => {
            if (!activeDatabase) {
              api.createDatabase(data)
                .then(async (db) => {
                  selectedDatabase.value = db.id;
                  form.reset();
                  databases.value = (await api.getDatabases()).data;
                  createDatabaseRef.current?.close();
                });
            } else {
              api.updateDatabase({ id: activeDatabase.id, ...data })
                .then(async (db) => {
                  console.log("Database updated", db);
                  selectedDatabase.value = db.id;
                  form.reset();

                  databases.value = (await api.getDatabases()).data;
                  createDatabaseRef.current?.close();
                });
            }
          }}
          database={activeDatabase}
        />
      </Dialog>
    </>
  );
}
