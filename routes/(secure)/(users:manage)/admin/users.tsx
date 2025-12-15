import { define } from "@/utils.ts";
import { deleteUser, getAllUsers, updateUserPermissions } from "@/lib/users.ts";

import UsersTable from "@/islands/admin/UsersTable.tsx";
import { db } from "@/lib/db.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const action = form.get("action");
    const userId = form.get("userId")?.toString();

    if (!userId) {
      return ctx.redirect("/admin/users");
    }

    const user = await db.users.find(userId);
    if (!user) {
      ctx.state.flash("error", "User not found");
      return ctx.redirect("/admin/users");
    }

    // Prevent modifying self
    if (user.value.email === ctx.state.user!.email) {
      ctx.state.flash("error", "Cannot modify self");
      return ctx.redirect("/admin/users");
    }

    if (action === "update_permissions") {
      const permissionsStr = form.get("permissions")?.toString() || "";
      // Split by comma and clean up whitespace
      const permissions = permissionsStr
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      await updateUserPermissions(userId, permissions);
      ctx.state.flash("success", "User permissions updated");
    }

    return ctx.redirect("/admin/users");
  },

  async DELETE(ctx) {
    // Allow passing ID via JSON body
    let userId: string | undefined;
    try {
      const body = await ctx.req.json();
      userId = body.userId;
    } catch {
      // Fallback or error
    }

    if (!userId) {
      ctx.state.flash("error", "Missing userId");
      return new Response("Missing userId", { status: 400 });
    }

    const user = await db.users.find(userId);
    if (!user) {
      ctx.state.flash("error", "User not found");
      return new Response("User not found", { status: 404 });
    }

    // Prevent deleting self
    if (user.value.email === ctx.state.user!.email) {
      ctx.state.flash("error", "Cannot delete self");
      return new Response("Cannot delete self", { status: 400 });
    }

    await deleteUser(userId);
    ctx.state.flash("success", "User deleted successfully");
    return new Response(null, { status: 204 });
  },
});

export default define.page(async function AdminUsers({ state }) {
  const users = await getAllUsers();
  users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const success = state.flash("success");
  const error = state.flash("error");

  return (
    <div class="min-h-screen bg-base-100 text-base-content p-8">
      <div class="max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold flex items-center gap-3">
            <span class="text-brand">Admin</span> Users
          </h1>
          <a href="/" class="btn btn-ghost gap-2">
            &larr; Back to Dashboard
          </a>
        </div>

        {success && (
          <div role="alert" class="alert alert-success mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div role="alert" class="alert alert-error mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <UsersTable initialUsers={users} currentUserEmail={state.user!.email} />
      </div>
    </div>
  );
});
