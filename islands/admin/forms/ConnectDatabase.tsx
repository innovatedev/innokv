import { Database } from "@/lib/models.ts";

export default function ConnectDatabaseForm({
  onSubmit,
  onCancel,
  onDelete,
  database,
  isLoading,
  error,
  success,
}: {
  onSubmit?: (data: any, form: HTMLFormElement) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  database?: Database | null;
  isLoading?: boolean;
  error?: string;
  success?: string;
}) {
  const doSubmit = (e: Event) => {
    if (onSubmit) {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
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
      class="form-control w-full flex flex-col"
      onSubmit={doSubmit}
      method="post"
    >
      {error && (
        <div class="alert alert-error mt-2">
          <div>
            <span>{error}</span>
          </div>
        </div>
      )}
      {success && (
        <div class="alert alert-success mt-2">
          <div>
            <span>{success}</span>
          </div>
        </div>
      )}
      <label class="label flex flex-col items-start">
        <span class="label-text">Slug</span>
        <input
          class="input input-bordered input-xs w-full"
          type="text"
          name="slug"
          defaultValue={database?.slug}
          required
        />
      </label>
      <label class="label flex flex-col items-start">
        <span class="label-text">Path</span>
        <input
          class="input input-bordered input-xs w-full"
          type="text"
          name="path"
          defaultValue={database?.path}
          required
        />
      </label>
      <label class="label flex flex-col items-start">
        <span class="label-text">Name</span>
        <input
          class="input input-bordered input-xs w-full"
          type="text"
          name="name"
          defaultValue={database?.name}
          required
        />
      </label>
      <label class="label flex flex-col items-start">
        <span class="label-text">Type</span>
        <select
          class="select select-bordered select-xs w-full"
          name="type"
          defaultValue={database?.type}
          required
        >
          <option value="memory">Memory</option>
          <option value="file">File</option>
          <option value="remote">Remote</option>
        </select>
      </label>
      <label class="label flex flex-col items-start">
        <span class="label-text">Mode</span>
        <select
          class="select select-bordered select-xs w-full"
          name="mode"
          defaultValue={database?.mode}
          required
        >
          <option value="r">Read</option>
          <option value="rw">Read/Write</option>
        </select>
      </label>
      <label class="label flex flex-col items-start">
        <span class="label-text">Description</span>
        <input
          class="input input-bordered input-xs w-full"
          type="text"
          name="description"
          defaultValue={database?.description}
        />
      </label>
      <label class="label flex flex-col items-start">
        <span class="label-text">Sort</span>
        <input
          class="input input-bordered input-xs w-full"
          type="number"
          min="0"
          name="sort"
          defaultValue={database?.sort}
        />
      </label>

      <div class="flex justify-between gap-4 mt-4">
        <div>
          {database?.id && onDelete && (
            <button
              class="btn btn-danger btn-ghost btn-xs"
              type="button"
              onClick={doDelete}
              disabled={isLoading}
            >
              Delete
            </button>
          )}
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-ghost btn-xs"
            type="button"
            onClick={doCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            class="btn btn-primary btn-xs"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : (database ? "Save" : "Connect")}
          </button>
        </div>
      </div>
    </form>
  );
}
