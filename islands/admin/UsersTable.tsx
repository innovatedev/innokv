import { useEffect, useRef, useState } from "preact/hooks";
import { User } from "@/lib/users.ts";
import Dialog from "./Dialog.tsx";
import { SearchIcon } from "../../components/icons/ActionIcons.tsx";
import PermissionEditor from "@/islands/admin/PermissionEditor.tsx";
import { hasPermission } from "@/lib/permissions.ts";

interface UsersTableProps {
  initialUsers: User[];
  currentUserEmail: string;
}

export default function UsersTable(
  { initialUsers, currentUserEmail }: UsersTableProps,
) {
  const [users] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // State for permissions in the edit modal
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);

  const dialogRef = useRef<HTMLDialogElement>(null);

  const filteredUsers = users.filter((u) => {
    if (!appliedSearch) return true;
    const searchLower = appliedSearch.toLowerCase();
    const emailMatch = u.email.toLowerCase().includes(searchLower);
    const permMatch = u.permissions.some((p: string) =>
      p.toLowerCase().includes(searchLower)
    );
    return emailMatch || permMatch;
  });

  const onSearch = () => {
    setAppliedSearch(searchQuery);
  };

  const onClearSearch = () => {
    setSearchQuery("");
    setAppliedSearch("");
  };

  useEffect(() => {
    if (selectedUser && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!selectedUser && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [selectedUser]);

  const handleEditUser = (user: User) => {
    setCustomPermissions([...user.permissions]);
    setSelectedUser(user);
  };

  const isSelf = selectedUser?.email === currentUserEmail;

  return (
    <div>
      <div class="mb-6 flex flex-col md:flex-row gap-4 justify-between items-end">
        <div class="join flex-1 max-w-xl">
          <div
            class={`relative flex-1 group join-item border transition-colors bg-base-100/50 focus-within:bg-base-100 ${
              appliedSearch ? "border-primary" : "border-base-300"
            }`}
          >
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors z-10">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              class="w-full h-10 pl-10 pr-10 text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-base-content"
              value={searchQuery}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
                if (e.key === "Escape") onClearSearch();
              }}
            />
            {searchQuery && (
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-circle btn-xs opacity-40 hover:opacity-100"
                onClick={onClearSearch}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            class={`btn btn-sm h-10 join-item px-6 transition-all ${
              appliedSearch ? "btn-primary" : "btn-neutral"
            }`}
            onClick={onSearch}
          >
            Search
          </button>
        </div>
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
                  {new Date(user.createdAt!).toLocaleString()}
                </td>
                <td class="text-sm opacity-70">
                  {new Date(user.lastLoginAt!).toLocaleString()}
                </td>
                <td>
                  <div class="flex gap-1 flex-wrap">
                    {hasPermission(user.permissions, "*")
                      ? <span class="badge badge-sm badge-primary">Admin</span>
                      : user.permissions.length === 0
                      ? (
                        <span class="badge badge-sm badge-ghost opacity-50">
                          No Access
                        </span>
                      )
                      : (
                        <>
                          <span
                            class={`badge badge-sm ${
                              user.permissions[0].startsWith("-")
                                ? "badge-error badge-outline"
                                : "badge-neutral"
                            }`}
                          >
                            {user.permissions[0]}
                          </span>
                          {user.permissions.length > 1 && (
                            <span class="badge badge-sm badge-ghost opacity-70">
                              + {user.permissions.length - 1} more
                            </span>
                          )}
                        </>
                      )}
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost"
                    onClick={() => handleEditUser(user)}
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
              <input
                type="hidden"
                name="permissions"
                value={customPermissions.join(",")}
              />

              <div class="form-control">
                <span class="label-text font-bold mb-2">Permissions</span>
                <PermissionEditor
                  initialPermissions={customPermissions}
                  onChange={setCustomPermissions}
                />
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
                    class="btn btn-sm btn-brand"
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
