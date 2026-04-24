import { Command } from "@cliffy/command";
import { Input, Secret } from "@cliffy/prompt";
import { deleteConfig, readConfig, writeConfig } from "../config.ts";
import { authenticateUser } from "../../lib/users.ts";
import { createToken } from "../../lib/tokens.ts";

export const login = new Command()
  .description("Log in to InnoKV")
  .action(async () => {
    await doLocalLogin();
  });

async function doLocalLogin() {
  console.log("\nLogging in with credentials...");

  const email = await Input.prompt({
    message: "Email",
    validate: (val) => val.includes("@") || "Invalid email address",
  });

  const password = await Secret.prompt("Password");

  console.log("Verifying credentials...");
  const auth = await authenticateUser(email, password);

  if (!auth.ok || !auth.id) {
    console.error(`\n❌ Login failed: ${auth.error || "Unknown error"}`);
    return;
  }

  console.log("Creating API token...");
  const tokenResult = await createToken(auth.id, {
    name: `CLI Login (${new Date().toLocaleString()})`,
    type: "personal",
    rules: [],
    expiresAt: undefined,
  });

  if (tokenResult.ok && tokenResult.secret) {
    await writeConfig({ token: tokenResult.secret, email });
    console.log(`\n✅ Login successful! Authenticated as: ${email}`);
  } else {
    console.error(`\n❌ Failed to create API token: ${tokenResult.error}`);
  }
}

import { getDefaultDbPath } from "../../lib/paths.ts";

export const whoami = new Command()
  .description("Show current authentication status and environment")
  .action(async () => {
    const config = await readConfig();
    const dbPath = getDefaultDbPath();

    console.log("\nInnoKV Status:");
    console.log(`Internal DB: ${dbPath}`);

    if (config.token) {
      console.log(`Session:     Logged In`);
      console.log(`Email:       ${config.email || "Unknown"}`);
    } else {
      console.log("Session:     Not Logged In");
      console.log("\nRun 'innokv login' to authenticate.");
    }
  });

export const logout = new Command()
  .description("Log out from the CLI")
  .action(async () => {
    await deleteConfig();
    console.log("\n✅ Successfully logged out.");
  });
