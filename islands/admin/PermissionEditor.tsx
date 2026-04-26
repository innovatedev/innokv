import { useEffect, useState } from "preact/hooks";
import { PermissionWizard } from "./components/PermissionWizard.tsx";
import { RawPermissionEditor } from "./components/RawPermissionEditor.tsx";

interface PermissionEditorProps {
  initialPermissions: string[];
  onChange: (permissions: string[]) => void;
}

export default function PermissionEditor(
  { initialPermissions, onChange }: PermissionEditorProps,
) {
  const [activeTab, setActiveTab] = useState<"wizard" | "raw">("wizard");
  const [permissions, setPermissions] = useState<string[]>(initialPermissions);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    onChange(permissions);
  }, [permissions]);

  const addPermissions = (newPerms: string[]) => {
    const updated = [...permissions];
    let changed = false;
    for (const p of newPerms) {
      if (p && !updated.includes(p)) {
        updated.push(p);
        changed = true;
      }
    }
    if (changed) {
      setPermissions(updated);
      setIsEditorOpen(false);
    }
  };

  const removePermission = (perm: string) => {
    setPermissions(permissions.filter((p) => p !== perm));
  };

  return (
    <div class="flex flex-col gap-4">
      {/* 1. Permissions List (Now at top) */}
      <div class="p-4 bg-base-100 rounded border border-base-200">
        <span class="text-xs font-bold opacity-50 uppercase mb-2 block">
          Current Permissions
        </span>
        <div class="flex flex-wrap gap-1 min-h-[50px] content-start">
          {permissions.length === 0 && (
            <span class="text-xs opacity-30 italic p-1">
              No permissions configured
            </span>
          )}
          {permissions.map((p) => (
            <div
              key={p}
              class={`badge badge-sm gap-1 ${
                p.startsWith("-")
                  ? "badge-error badge-outline"
                  : "badge-neutral"
              }`}
            >
              {p}
              <button
                type="button"
                class="cursor-pointer hover:text-error hover:font-bold"
                onClick={() => removePermission(p)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Add Button or Editor */}
      {!isEditorOpen
        ? (
          <button
            type="button"
            class="btn btn-sm btn-outline btn-neutral w-full border-dashed"
            onClick={() => setIsEditorOpen(true)}
          >
            + Add Permission
          </button>
        )
        : (
          <div class="flex flex-col gap-4 bg-base-200 p-4 rounded-lg border border-base-300 relative">
            <button
              type="button"
              class="btn btn-xs btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setIsEditorOpen(false)}
            >
              ✕
            </button>

            {/* Tabs */}
            <div role="tablist" class="tabs tabs-boxed">
              <a
                role="tab"
                class={`tab ${activeTab === "wizard" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("wizard")}
              >
                Wizard
              </a>
              <a
                role="tab"
                class={`tab ${activeTab === "raw" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("raw")}
              >
                Raw Editor
              </a>
            </div>

            {/* Wizard Tab */}
            {activeTab === "wizard" && (
              <PermissionWizard onAdd={addPermissions} />
            )}

            {/* Raw Tab */}
            {activeTab === "raw" && (
              <RawPermissionEditor onAdd={(p) => addPermissions([p])} />
            )}
          </div>
        )}
    </div>
  );
}
