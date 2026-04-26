import { defineAuth } from "@/utils.ts";
import { changePassword, updateUserSettings } from "@/lib/users.ts";
import { verify } from "@felix/argon2";
import { db } from "@/kv/db.ts";
import { Button } from "../../../components/Button.tsx";
import { HttpError } from "fresh";

export const handler = defineAuth.handlers({
  async POST(ctx) {
    const userId = ctx.state.userId;
    const form = await ctx.req.formData();
    const action = form.get("_action")?.toString();
    // Handle Password Change
    if (action === "password") {
      const currentPassword = form.get("currentPassword")?.toString();
      const newPassword = form.get("newPassword")?.toString();
      const confirmPassword = form.get("confirmPassword")?.toString();

      if (!currentPassword || !newPassword || !confirmPassword) {
        ctx.state.flash("error", "All fields are required");
        return ctx.redirect("/user/settings");
      }

      if (newPassword !== confirmPassword) {
        ctx.state.flash("error", "New passwords do not match");
        return ctx.redirect("/user/settings");
      }

      // Verify current password first
      const userDoc = await db.users.find(userId);
      if (!userDoc) {
        ctx.state.flash("error", "User not found");
        return ctx.redirect("/user/settings");
      }

      const isValid = await verify(
        userDoc.value.passwordHash,
        currentPassword,
      );
      if (!isValid) {
        ctx.state.flash("error", "Invalid current password");
        return ctx.redirect("/user/settings");
      }

      const success = await changePassword(userId, newPassword);
      if (success) {
        ctx.state.flash("success", "Password changed successfully");
      } else {
        ctx.state.flash("error", "Failed to change password");
      }
      return ctx.redirect("/user/settings");
    }

    // Handle General Settings Update
    if (action === "preferences") {
      const hideEmail = form.get("hideEmail") === "on";

      const success = await updateUserSettings(userId, { hideEmail });

      if (success) {
        ctx.state.flash("success", "Preferences updated");
      } else {
        ctx.state.flash("error", "Failed to update preferences");
      }
      return ctx.redirect("/user/settings");
    }

    throw new HttpError(400, "Invalid request");
  },
});

export default defineAuth.page(function SettingsPage({ state }) {
  const userSettings = state.user?.settings;
  const successMessage = state.flash("success");
  const errorMessage = state.flash("error");

  return (
    <div class="hero min-h-screen bg-base-200">
      <div class="hero-content flex-col w-full max-w-4xl">
        <div class="text-center lg:text-left mb-4 w-full max-w-sm">
          <div class="flex items-center gap-2 mb-2">
            <a href="/" class="btn btn-ghost btn-xs">← Dashboard</a>
          </div>
          <h1 class="text-2xl font-bold">User Settings</h1>
        </div>

        {successMessage && (
          <div
            role="alert"
            class="alert alert-success shadow-sm w-full max-w-sm mb-4"
          >
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            class="alert alert-error shadow-sm w-full max-w-sm mb-4"
          >
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Preferences Section */}
        <div class="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100 mb-4">
          <div class="card-body">
            <h2 class="card-title text-base border-b border-base-200 pb-2">
              Preferences
            </h2>
            <form method="POST">
              <input type="hidden" name="_action" value="preferences" />
              <div class="form-control">
                <label class="label cursor-pointer justify-between flex">
                  <span class="label-text">Hide Email in Menu</span>
                  <input
                    type="checkbox"
                    name="hideEmail"
                    class="toggle toggle-primary toggle-sm"
                    checked={userSettings?.hideEmail}
                  />
                </label>
                <div class="label">
                  <span class="label-text-alt text-base-content/30">
                    Useful for screenshots/demos.
                  </span>
                </div>
              </div>
              <div class="form-control mt-2 flex justify-end">
                <Button type="submit">
                  Save Preferences
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Security Section */}
        <div class="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
          <div class="card-body">
            <h2 class="card-title text-base border-b border-base-200 pb-2">
              Change Password
            </h2>
            <form method="POST" class="flex flex-col gap-4">
              <input type="hidden" name="_action" value="password" />
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Current Password</span>
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  class="input input-bordered input-sm"
                  required
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">New Password</span>
                </label>
                <input
                  type="password"
                  name="newPassword"
                  class="input input-bordered input-sm"
                  required
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Confirm Password</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  class="input input-bordered input-sm"
                  required
                />
              </div>
              <div class="form-control mt-4 flex justify-end">
                <Button type="submit">
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});
