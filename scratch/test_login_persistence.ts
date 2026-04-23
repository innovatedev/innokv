import { authenticateUser } from "../lib/users.ts";
import { db } from "../kv/db.ts";

const email = "admin@example.com";
const password = "password";

console.log("Testing authentication for:", email);
const result = await authenticateUser(email, password);
console.log("Result:", result);

if (result.ok && result.id) {
  console.log("Authentication successful, checking session save...");
  try {
    const sessionDoc = await db.sessions.set(crypto.randomUUID(), {
      userId: result.id,
      data: {
        settings: {},
        flash: {},
        csrf: "test",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000000),
    });
    console.log("Session save result:", sessionDoc);
  } catch (e) {
    console.error("Session save FAILED:", e);
  }
} else {
  console.log("Authentication FAILED");
}
