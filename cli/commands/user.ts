import { Command } from "@cliffy/command";
import { Checkbox, Input, Secret } from "@cliffy/prompt";
import { findUserByEmail } from "../../lib/users.ts";
import { doUserAdd, doUserLs, doUserResetPassword } from "../actions.ts";

export const user = new Command()
  .description("Manage users")
  .action(() => user.showHelp())
  .command(
    "reset-password",
    new Command()
      .description("Reset a user's password")
      .arguments("<email:string>")
      .action(async (_options, email) => {
        try {
          const newPassword = await Secret.prompt("Enter new password");
          const confirmPassword = await Secret.prompt("Confirm new password");

          if (newPassword !== confirmPassword) {
            console.error("Error: Passwords do not match.");
            Deno.exit(1);
          }

          const success = await doUserResetPassword(email, newPassword);
          if (success) {
            console.log(`Successfully reset password for user: ${email}`);
          } else {
            console.error("Error: Failed to update password.");
            Deno.exit(1);
          }
        } catch (e) {
          console.error(e instanceof Error ? e.message : String(e));
          Deno.exit(1);
        }
      }),
  )
  .command(
    "add",
    new Command()
      .description("Add a new user")
      .action(async () => {
        try {
          const email = await Input.prompt({
            message: "Enter email",
            validate: (val) => val.includes("@") || "Invalid email address",
          });
          const username = await Input.prompt({
            message: "Enter username (optional)",
          });

          const existing = await findUserByEmail(email);
          if (existing) {
            console.error(`Error: User with email '${email}' already exists.`);
            Deno.exit(1);
          }

          const password = await Secret.prompt("Enter password");
          const confirm = await Secret.prompt("Confirm password");

          if (password !== confirm) {
            console.error("Error: Passwords do not match.");
            Deno.exit(1);
          }

          const permissions: string[] = await Checkbox.prompt({
            message: "Select initial permissions",
            options: [
              { name: "Full Admin (*)", value: "*" },
              { name: "Read Database (database:read)", value: "database:read" },
              {
                name: "Write Database (database:write)",
                value: "database:write",
              },
              {
                name: "Manage Database (database:manage)",
                value: "database:manage",
              },
            ],
          });

          const result = await doUserAdd({
            username,
            email,
            password,
            permissions,
          });

          if (result.ok) {
            console.log(
              `Successfully created user: ${email} (ID: ${result.user?.id})`,
            );
          } else {
            console.error(`Error: ${result.error}`);
            Deno.exit(1);
          }
        } catch (e) {
          console.error(e instanceof Error ? e.message : String(e));
          Deno.exit(1);
        }
      }),
  )
  .command(
    "ls",
    new Command()
      .description("List all users")
      .action(async () => {
        try {
          const users = await doUserLs();
          if (users.length === 0) {
            console.log("No users found.");
            return;
          }

          console.log("\nUsers:");
          console.log("--------------------------------------------------");
          for (const u of users) {
            console.log(`${u.email} [ID: ${u.id}]`);
            console.log(`  Permissions: ${u.permissions.join(", ") || "none"}`);
            console.log(`  Created At: ${u.createdAt}`);
            console.log("--------------------------------------------------");
          }
        } catch (e) {
          console.error(e instanceof Error ? e.message : String(e));
          Deno.exit(1);
        }
      }),
  );
