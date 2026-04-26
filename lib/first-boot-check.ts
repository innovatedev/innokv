import { db } from "@/kv/db.ts";
import { createUser } from "@/lib/users.ts";
import { promptSecret } from "jsr:@std/cli@1";

export async function performFirstBootCheck() {
  const userCount = await db.users.count();
  if (userCount === 0) {
    console.log("\n=== First Boot Detected: No Users Found ===");
    console.log("Please create an admin account to continue.\n");

    let username = "";
    while (!username) {
      username = prompt("Enter Admin Username:")?.trim() || "";
    }

    let email = "";
    while (!email) {
      email = prompt("Enter Admin Email:")?.trim() || "";
    }

    let password = "";
    while (!password || password.length < 8) {
      const secret = promptSecret("Enter Admin Password (min 8 chars):");
      password = secret ? secret.trim() : "";
      if (password.length < 8) console.error("Password too short!");
    }

    const { ok, error } = await createUser({
      username,
      email,
      password,
      permissions: ["*"],
    });
    if (ok) {
      console.log(`\n✅ Admin user '${email}' created successfully!`);
    } else {
      console.error(`\n❌ Failed to create admin user: ${error}`);
      Deno.exit(1);
    }
  }
}
