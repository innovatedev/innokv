import { useState } from "preact/hooks";

export type WizardState = {
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

interface PermissionWizardProps {
  onAdd: (permissions: string[]) => void;
}

export function PermissionWizard({ onAdd }: PermissionWizardProps) {
  const [wizardState, setWizardState] = useState<WizardState>({
    effect: "allow",
    resource: "database",
    actions: { read: true, write: false, manage: false },
    scopeType: "all",
    scopeId: "",
  });

  const generateWizardPermission = () => {
    const { effect, resource, actions, scopeType, scopeId } = wizardState;
    const prefix = effect === "deny" ? "-" : "";
    const generated: string[] = [];

    if (resource === "admin") {
      if (effect === "allow") generated.push("*");
    } else {
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

  const previewPermissions = generateWizardPermission();
  const isAddDisabled = previewPermissions.length === 0;

  return (
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
          onClick={() => onAdd(previewPermissions)}
          disabled={isAddDisabled}
        >
          Add Rule
        </button>
      </div>
    </div>
  );
}
