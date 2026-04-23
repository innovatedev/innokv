import { useEffect, useState } from "preact/hooks";

interface PermissionEditorProps {
  initialPermissions: string[];
  onChange: (permissions: string[]) => void;
}

type WizardState = {
  effect: "allow" | "deny";
  resource: "database" | "users" | "admin";
  actions: {
    read: boolean;
    write: boolean;
    manage: boolean;
  };
  scopeType: "all" | "specific";
  scopeId: string;
};

export default function PermissionEditor(
  { initialPermissions, onChange }: PermissionEditorProps,
) {
  const [activeTab, setActiveTab] = useState<"wizard" | "raw">("wizard");
  const [permissions, setPermissions] = useState<string[]>(initialPermissions);

  // Wizard State
  const [wizardState, setWizardState] = useState<WizardState>({
    effect: "allow",
    resource: "database",
    actions: { read: true, write: false, manage: false },
    scopeType: "all",
    scopeId: "",
  });

  // Raw State
  const [newRawPermission, setNewRawPermission] = useState("");

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    onChange(permissions);
  }, [permissions]);

  const addPermission = (perm: string) => {
    if (perm && !permissions.includes(perm)) {
      setPermissions([...permissions, perm]);
      setIsEditorOpen(false); // Close after adding
      setWizardState({
        ...wizardState,
        actions: { read: true, write: false, manage: false },
        scopeType: "all",
        scopeId: "",
      }); // Reset wizard slightly
      setNewRawPermission("");
    }
  };

  const removePermission = (perm: string) => {
    setPermissions(permissions.filter((p) => p !== perm));
  };

  const generateWizardPermission = () => {
    const { effect, resource, actions, scopeType, scopeId } = wizardState;
    const prefix = effect === "deny" ? "-" : "";
    const generated: string[] = [];

    if (resource === "admin") {
      if (effect === "allow") generated.push("*");
      // cannot deny admin via wizard
    } else {
      // Validation for specific scope
      if (scopeType === "specific" && !scopeId.trim()) {
        return [];
      }

      const scopeSuffix = (scopeType === "specific" && scopeId)
        ? `:${scopeId}`
        : "";

      if (resource === "users") {
        if (actions.manage) {
          generated.push(`${prefix}users:manage${scopeSuffix}`);
        }
      } else {
        // Database
        if (actions.manage) {
          generated.push(`${prefix}${resource}:manage${scopeSuffix}`);
        }
        if (actions.write) {
          generated.push(`${prefix}${resource}:write${scopeSuffix}`);
        }
        if (actions.read) {
          generated.push(`${prefix}${resource}:read${scopeSuffix}`);
        }
      }
    }

    return generated;
  };

  const handleWizardAdd = () => {
    const newPerms = generateWizardPermission();
    const updated = [...permissions];
    for (const p of newPerms) {
      if (!updated.includes(p)) updated.push(p);
    }
    setPermissions(updated);
    setIsEditorOpen(false);
  };

  const previewPermissions = generateWizardPermission();
  const isAddDisabled = previewPermissions.length === 0;

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
              <div class="flex flex-col gap-4">
                {/* Effect */}
                <div class="form-control">
                  <span class="label-text font-bold mb-2">Effect</span>
                  <div class="flex gap-4">
                    <label class="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        class="radio radio-success"
                        checked={wizardState.effect === "allow"}
                        onClick={() =>
                          setWizardState({ ...wizardState, effect: "allow" })}
                      />
                      <span class="label-text">Allow</span>
                    </label>
                    <label class="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        class="radio radio-error"
                        checked={wizardState.effect === "deny"}
                        onClick={() =>
                          setWizardState({
                            ...wizardState,
                            effect: "deny",
                            resource: "database",
                          })}
                      />
                      <span class="label-text">Deny</span>
                    </label>
                  </div>
                </div>

                <div class="divider my-0"></div>

                {/* Resource */}
                <div class="form-control">
                  <span class="label-text font-bold mb-2">Resource</span>
                  <select
                    class="select select-bordered select-sm w-full"
                    value={wizardState.resource}
                    onChange={(e) => {
                      const res = e.currentTarget
                        .value as WizardState["resource"];
                      let actions = { read: true, write: false, manage: false };
                      if (res === "users") {
                        actions = { read: false, write: false, manage: true };
                      }
                      setWizardState({
                        ...wizardState,
                        resource: res,
                        actions,
                      });
                    }}
                  >
                    <option value="database">Database</option>
                    <option value="users">Users</option>
                    {wizardState.effect === "allow" && (
                      <option value="admin">Admin</option>
                    )}
                  </select>
                </div>

                {/* Actions */}
                {wizardState.resource === "database" && (
                  <div class="form-control">
                    <span class="label-text font-bold mb-2">Actions</span>
                    <div class="flex flex-wrap gap-4">
                      <label class="label cursor-pointer gap-2 border rounded px-2 hover:bg-base-100">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-xs"
                          checked={wizardState.actions.read}
                          onClick={() =>
                            setWizardState((s) => ({
                              ...s,
                              actions: { ...s.actions, read: !s.actions.read },
                            }))}
                        />
                        <span class="label-text">Read</span>
                      </label>
                      <label class="label cursor-pointer gap-2 border rounded px-2 hover:bg-base-100">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-xs"
                          checked={wizardState.actions.write}
                          onClick={() =>
                            setWizardState((s) => ({
                              ...s,
                              actions: {
                                ...s.actions,
                                write: !s.actions.write,
                              },
                            }))}
                        />
                        <span class="label-text">Write</span>
                      </label>
                      <label class="label cursor-pointer gap-2 border rounded px-2 hover:bg-base-100">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-xs"
                          checked={wizardState.actions.manage}
                          onClick={() =>
                            setWizardState((s) => ({
                              ...s,
                              actions: {
                                ...s.actions,
                                manage: !s.actions.manage,
                              },
                            }))}
                        />
                        <span class="label-text">Manage</span>
                      </label>
                    </div>
                  </div>
                )}

                {wizardState.resource === "users" && (
                  <div class="form-control">
                    <span class="label-text font-bold mb-2">Actions</span>
                    <div class="flex flex-wrap gap-4">
                      <label class="label cursor-pointer gap-2 border rounded px-2 hover:bg-base-100">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-xs"
                          checked={wizardState.actions.manage}
                          onClick={() =>
                            setWizardState((s) => ({
                              ...s,
                              actions: {
                                ...s.actions,
                                manage: !s.actions.manage,
                              },
                            }))}
                        />
                        <span class="label-text">Manage</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Scope */}
                {(wizardState.resource === "database" ||
                  wizardState.resource === "users") && (
                  <div class="form-control">
                    <span class="label-text font-bold mb-2">Scope</span>
                    <div class="flex flex-col gap-2">
                      <label class="label cursor-pointer justify-start gap-2">
                        <input
                          type="radio"
                          class="radio radio-sm"
                          checked={wizardState.scopeType === "all"}
                          onClick={() =>
                            setWizardState({
                              ...wizardState,
                              scopeType: "all",
                            })}
                        />
                        <span class="label-text">
                          {wizardState.resource === "database"
                            ? "All Databases"
                            : "All Users"}
                        </span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-2">
                        <input
                          type="radio"
                          class="radio radio-sm"
                          checked={wizardState.scopeType === "specific"}
                          onClick={() =>
                            setWizardState({
                              ...wizardState,
                              scopeType: "specific",
                            })}
                        />
                        <span class="label-text">
                          {wizardState.resource === "database"
                            ? "Specific ID/Slug"
                            : "Specific Email"}
                        </span>
                      </label>
                      {wizardState.scopeType === "specific" && (
                        <input
                          type="text"
                          class="input input-sm input-bordered ml-8"
                          placeholder={wizardState.resource === "database"
                            ? "e.g. usage_stats"
                            : "e.g. user@example.com"}
                          value={wizardState.scopeId}
                          onInput={(e) =>
                            setWizardState({
                              ...wizardState,
                              scopeId: e.currentTarget.value,
                            })}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div class="divider my-0"></div>

                {/* Preview & Add */}
                <div class="flex justify-between items-end">
                  <div class="flex flex-col gap-1 w-full mr-2">
                    <span class="text-xs opacity-50 uppercase font-bold">
                      Rule Preview
                    </span>
                    <div class="flex flex-wrap gap-1 min-h-6">
                      {previewPermissions.length > 0
                        ? previewPermissions.map((p) => (
                          <span
                            key={p}
                            class={`badge badge-sm ${
                              wizardState.effect === "deny"
                                ? "badge-error badge-outline"
                                : "badge-neutral"
                            }`}
                          >
                            {p}
                          </span>
                        ))
                        : (
                          <span class="text-xs italic opacity-40">
                            Select options...
                          </span>
                        )}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm btn-brand"
                    onClick={handleWizardAdd}
                    disabled={isAddDisabled}
                  >
                    Add Rule
                  </button>
                </div>
              </div>
            )}

            {/* Raw Tab */}
            {activeTab === "raw" && (
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
                        addPermission(newRawPermission);
                      }
                    }}
                  />
                  <button
                    type="button"
                    class="btn btn-sm btn-square"
                    onClick={() => {
                      addPermission(newRawPermission);
                    }}
                    disabled={!newRawPermission}
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
                  Type a permission string and press Enter. Use <code>-</code>
                  {" "}
                  for deny rules.
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
