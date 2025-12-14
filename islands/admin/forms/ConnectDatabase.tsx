import { Database } from "@/lib/models.ts";
import { useState } from "preact/hooks";

export default function ConnectDatabaseForm({
  onSubmit,
  onCancel,
  onDelete,
  database,
  isLoading,
  error,
  success,
  method,
}: {
  onSubmit?: (data: any, form: HTMLFormElement) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  database?: Database | null;
  isLoading?: boolean;
  error?: string;
  success?: string;
  method?: "post" | "dialog";
}) {
  const [dbType, setDbType] = useState<string>(database?.type || "memory");

  const doSubmit = (e: Event) => {
    if (onSubmit) {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const data: any = Object.fromEntries(formData.entries());

      // Handle nested settings
      if (data["settings.prettyPrintDates"]) {
        data.settings = {
          prettyPrintDates: data["settings.prettyPrintDates"] === "true",
        };
        delete data["settings.prettyPrintDates"];
      } else {
        data.settings = {
          prettyPrintDates: false,
        };
      }

      onSubmit(data, form);
    }
  };

  const doCancel = (e: Event) => {
    e.preventDefault();
    if (onCancel) {
      onCancel();
    }
  };

  const doDelete = (e: Event) => {
    e.preventDefault();
    if (database && database.id) {
      if (
        confirm(
          `Are you sure you want to delete the database "${database.name}"?`,
        )
      ) {
        if (onDelete) {
          onDelete();
        }
      }
    }
  };
  return (
    <form
      class="form-control w-full flex flex-col gap-3"
      onSubmit={doSubmit}
      method={method || "post"}
    >
      {error && (
        <div class="alert alert-error text-sm py-2 rounded">
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div class="alert alert-success text-sm py-2 rounded">
          <span>{success}</span>
        </div>
      )}

      {/* Basic Info */}
      <div class="grid grid-cols-2 gap-4">
        <label class="form-control w-full">
          <div class="label pb-1">
            <span class="label-text text-xs opacity-70">Name</span>
          </div>
          <input
            class="input input-bordered input-sm w-full"
            type="text"
            name="name"
            defaultValue={database?.name}
            placeholder="My Database"
            required
          />
        </label>
        <label class="form-control w-full">
          <div class="label pb-1">
            <span class="label-text text-xs opacity-70">Slug</span>
          </div>
          <input
            class="input input-bordered input-sm w-full"
            type="text"
            name="slug"
            defaultValue={database?.slug}
            placeholder="my-database"
            required
          />
        </label>
      </div>

      <label class="form-control w-full">
        <div class="label pb-1">
          <span class="label-text text-xs opacity-70">Description</span>
        </div>
        <input
          class="input input-bordered input-sm w-full"
          type="text"
          name="description"
          defaultValue={database?.description}
          placeholder="A brief description of this database"
        />
      </label>

      {/* Connection Info */}
      {/* Connection Info */}
      <div class="grid grid-cols-2 gap-4">
        <label class="form-control w-full">
          <div class="label pb-1">
            <span class="label-text text-xs opacity-70">Type</span>
          </div>
          <select
            class="select select-bordered select-sm w-full"
            name="type"
            value={dbType}
            onChange={(e) => setDbType((e.target as HTMLSelectElement).value)}
            required
          >
            <option value="memory">Memory</option>
            <option value="file">File</option>
            <option value="remote">Remote</option>
          </select>
        </label>

        {/* Hide Mode if creating new Memory DB (must be RW) */}
        {!(dbType === "memory" && !database)
          ? (
            <label class="form-control w-full">
              <div class="label pb-1">
                <span class="label-text text-xs opacity-70">Mode</span>
              </div>
              <select
                class="select select-bordered select-sm w-full"
                name="mode"
                defaultValue={database?.mode || "rw"}
                required
              >
                <option value="r">Read Only</option>
                <option value="rw">Read/Write</option>
              </select>
            </label>
          )
          : <input type="hidden" name="mode" value="rw" />}
      </div>

      {dbType !== "memory"
        ? (
          <label class="form-control w-full">
            <div class="label pb-1">
              <span class="label-text text-xs opacity-70">
                {dbType === "remote" ? "Connection URL" : "File Path"}
              </span>
            </div>
            <input
              class="input input-bordered input-sm w-full font-mono text-xs"
              type="text"
              name="path"
              defaultValue={database?.path}
              placeholder={dbType === "remote"
                ? "https://api.deno.com/databases/<UUID>"
                : "/path/to/db.sqlite"}
              required
            />
            {dbType === "remote" && (
              <>
                <div class="label pb-0 pt-1">
                  <span class="label-text-alt text-xs opacity-50">
                    Provide the <code>DENO_KV_ACCESS_TOKEN</code>{" "}
                    for this database. (Optional if server env var is set)
                  </span>
                </div>
                <label class="form-control w-full mt-2">
                  <div class="label pb-1">
                    <span class="label-text text-xs opacity-70">
                      Access Token
                    </span>
                  </div>
                  <input
                    class="input input-bordered input-sm w-full font-mono text-xs"
                    type="password"
                    name="accessToken"
                    placeholder="dk_..."
                    autoComplete="off"
                  />
                </label>
              </>
            )}
          </label>
        )
        : <input type="hidden" name="path" value=":memory:" />}

      <div class="form-control mt-2">
        <label class="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            name="settings.prettyPrintDates"
            class="checkbox checkbox-xs checkbox-primary"
            defaultChecked={database?.settings?.prettyPrintDates ?? true}
            value="true"
          />
          <span class="label-text text-sm">Pretty Print Dates</span>
        </label>
      </div>

      <div class="modal-action flex justify-between items-center mt-6">
        <div>
          {database?.id && onDelete && (
            <button
              class="btn btn-error btn-outline btn-xs hover:btn-error hover:text-white"
              type="button"
              onClick={doDelete}
              disabled={isLoading}
            >
              Delete Database
            </button>
          )}
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            onClick={doCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            class="btn btn-sm bg-brand hover:bg-brand/80 text-black border-none min-w-[80px]"
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? <span class="loading loading-spinner loading-xs"></span>
              : (database ? "Save" : "Connect")}
          </button>
        </div>
      </div>
    </form>
  );
}
