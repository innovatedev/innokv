import { useState } from "preact/hooks";

interface RawPermissionEditorProps {
  onAdd: (permission: string) => void;
}

export function RawPermissionEditor({ onAdd }: RawPermissionEditorProps) {
  const [newRawPermission, setNewRawPermission] = useState("");

  const handleAdd = () => {
    if (newRawPermission.trim()) {
      onAdd(newRawPermission.trim());
      setNewRawPermission("");
    }
  };

  return (
    <div>
      <div class="flex gap-2 mb-2">
        <input
          type="text"
          class="input input-sm input-bordered flex-1"
          placeholder="e.g. database:read:mydb or -database:read:secret"
          value={newRawPermission}
          onInput={(e) => setNewRawPermission(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          class="btn btn-sm btn-square"
          onClick={handleAdd}
          disabled={!newRawPermission.trim()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
      <div class="text-[10px] opacity-50">
        Type a permission string and press Enter. Use <code>-</code>{" "}
        for deny rules.
      </div>
    </div>
  );
}
