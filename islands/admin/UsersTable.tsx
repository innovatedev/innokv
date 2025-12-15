import { useEffect, useRef, useState } from "preact/hooks";
import { UserWithId } from "@/lib/users.ts";
import Dialog from "./Dialog.tsx";

interface UsersTableProps {
  initialUsers: UserWithId[];
  currentUserEmail: string;
}

export default function UsersTable(
  { initialUsers, currentUserEmail }: UsersTableProps,
) {
  const [users] = useState<UserWithId[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);

  // State for permissions in the edit modal
  const [editPreset, setEditPreset] = useState<
    "admin" | "user_manager" | "manager" | "none"
  >(
    "none",
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getPermissionType = (perms: string[]) => {
    if (perms.includes("*")) return "admin";
    if (perms.includes("users:manage")) return "user_manager";
    if (perms.includes("database:manage")) return "manager";
    return "none";
  };

  useEffect(() => {
    if (selectedUser && dialogRef.current) {
      setEditPreset(getPermissionType(selectedUser.permissions));
      dialogRef.current.showModal();
    } else if (!selectedUser && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [selectedUser]);

  const isSelf = selectedUser?.email === currentUserEmail;

  return (
    <div>
      <div class="mb-6">
        <input
          type="text"
          placeholder="Search users by email..."
          class="input input-bordered w-full max-w-md"
          value={search}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
      </div>

      <div class="overflow-x-auto bg-base-200 rounded-box shadow-xl border border-base-300">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Email</th>
              <th>Created At</th>
              <th>Last Login</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td class="font-bold">{user.email}</td>
                <td class="text-sm opacity-70">
                  {new Date(user.createdAt).toLocaleString()}
                </td>
                <td class="text-sm opacity-70">
                  {new Date(user.lastLoginAt).toLocaleString()}
                </td>
                <td>
                  <div class="flex gap-1 flex-wrap">
                    {user.permissions.includes("*")
                      ? <span class="badge badge-sm badge-primary">Admin</span>
                      : user.permissions.includes("users:manage")
                      ? (
                        <span class="badge badge-sm badge-success">
                          User Manager
                        </span>
                      )
                      : user.permissions.includes("database:manage")
                      ? (
                        <span class="badge badge-sm badge-secondary">
                          DB Manager
                        </span>
                      )
                      : (
                        <span class="badge badge-sm badge-ghost opacity-50">
                          No Access
                        </span>
                      )}
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost"
                    onClick={() => setSelectedUser(user)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} class="text-center py-8 opacity-50">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog ref={dialogRef} title="Edit User">
        {selectedUser && (
          <div class="flex flex-col gap-4">
            <label class="form-control w-full">
              <div class="label pb-1">
                <span class="label-text text-xs opacity-70">Email</span>
              </div>
              <input
                type="text"
                value={selectedUser.email}
                disabled
                class="input input-bordered input-sm w-full opacity-70"
              />
            </label>

            <form method="POST" class="flex flex-col gap-4">
              <input type="hidden" name="action" value="update_permissions" />
              <input type="hidden" name="userId" value={selectedUser.id} />
              {/* Map preset back to backend string format */}
              <input
                type="hidden"
                name="permissions"
                value={editPreset === "admin"
                  ? "*"
                  : (editPreset === "user_manager"
                    ? "users:manage"
                    : (editPreset === "manager" ? "database:manage" : ""))}
              />

              <div class="form-control">
                <span class="label-text font-bold mb-2">Access Level</span>

                <label class="label cursor-pointer justify-start gap-3 border rounded p-2 hover:bg-base-200 mb-2">
                  <input
                    type="radio"
                    name="permission_preset"
                    class="radio radio-sm"
                    value="none"
                    checked={editPreset === "none"}
                    onChange={() => setEditPreset("none")}
                    disabled={isSelf}
                  />
                  <div class="flex flex-col">
                    <span class="label-text font-medium">No Access</span>
                    <span class="text-xs opacity-60">
                      User cannot access admin panel.
                    </span>
                  </div>
                </label>

                <label class="label cursor-pointer justify-start gap-3 border rounded p-2 hover:bg-base-200 mb-2">
                  <input
                    type="radio"
                    name="permission_preset"
                    class="radio radio-sm radio-secondary"
                    value="manager"
                    checked={editPreset === "manager"}
                    onChange={() => setEditPreset("manager")}
                    disabled={isSelf}
                  />
                  <div class="flex flex-col">
                    <span class="label-text font-medium">DB Manager</span>
                    <span class="text-xs opacity-60">
                      Can manage databases.
                    </span>
                  </div>
                </label>

                <label class="label cursor-pointer justify-start gap-3 border rounded p-2 hover:bg-base-200 mb-2">
                  <input
                    type="radio"
                    name="permission_preset"
                    class="radio radio-sm radio-success"
                    value="user_manager"
                    checked={editPreset === "user_manager"}
                    onChange={() => setEditPreset("user_manager")}
                    disabled={isSelf}
                  />
                  <div class="flex flex-col">
                    <span class="label-text font-medium">User Manager</span>
                    <span class="text-xs opacity-60">
                      Can manage users but not databases.
                    </span>
                  </div>
                </label>

                <label class="label cursor-pointer justify-start gap-3 border rounded p-2 hover:bg-base-200">
                  <input
                    type="radio"
                    name="permission_preset"
                    class="radio radio-sm radio-primary"
                    value="admin"
                    checked={editPreset === "admin"}
                    onChange={() => setEditPreset("admin")}
                    disabled={isSelf}
                  />
                  <div class="flex flex-col">
                    <span class="label-text font-medium">Super Admin</span>
                    <span class="text-xs opacity-60">
                      Full access to users and databases.
                    </span>
                  </div>
                </label>

                {isSelf && (
                  <div class="alert alert-info text-xs mt-2 py-2">
                    <span>You cannot change your own permissions.</span>
                  </div>
                )}
              </div>

              <div class="modal-action flex justify-between items-center mt-6">
                <div>
                  {!isSelf && (
                    <button
                      type="button"
                      class="btn btn-error btn-outline btn-xs"
                      onClick={async () => {
                        if (
                          !confirm(
                            `Are you sure you want to delete ${selectedUser.email}?`,
                          )
                        ) return;

                        await fetch("/admin/users", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: selectedUser.id }),
                        });

                        globalThis.location.reload();
                      }}
                    >
                      Delete User
                    </button>
                  )}
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    onClick={() => setSelectedUser(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="btn btn-sm btn-primary"
                    disabled={isSelf}
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </Dialog>
    </div>
  );
}
