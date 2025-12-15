import { authenticateUser, createUser, findUserByEmail } from "@/lib/users.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";
import { db } from "@/lib/db.ts";

async function cleanup(email: string) {
  const user = await findUserByEmail(email);
  if (user) {
    await db.users.delete(user.id);
  }
}

Deno.test("User Management - Create and Authenticate", async (t) => {
  const testEmail = "test_user_unique@example.com";
  const testPass = "supersecret123";

  // Ensure clean state
  await cleanup(testEmail);

  await t.step("Create User", async () => {
    const { ok, user, error } = await createUser({
      email: testEmail,
      password: testPass,
    });
    assert(ok, `Failed to create user: ${error}`);
    assert(user, "User object should be returned");
    assertEquals(user.email, testEmail);
    assertEquals(user.permissions, []);
  });

  await t.step("Create Admin User", async () => {
    const adminEmail = "admin_test@example.com";
    await cleanup(adminEmail);

    const { ok, user } = await createUser({
      email: adminEmail,
      password: testPass,
      permissions: ["*"],
    });
    assert(ok, "Should create admin user");
    assertEquals(user?.permissions, ["*"]);

    await cleanup(adminEmail);
  });

  await t.step("Prevent Duplicate User", async () => {
    const { ok, error } = await createUser({
      email: testEmail,
      password: "otherpass",
    });
    assertEquals(ok, false);
    assertEquals(error, "User already exists");
  });

  await t.step("Authenticate User - Success", async () => {
    const { ok, user, id } = await authenticateUser(testEmail, testPass);
    assert(ok, "Authentication should succeed");
    assert(user, "User object should be returned");
    assert(id, "User ID should be returned");
    assertEquals(user?.email, testEmail);
  });

  await t.step("Authenticate User - Wrong Password", async () => {
    const { ok, error } = await authenticateUser(testEmail, "wrongpass");
    assertEquals(ok, false);
    assertEquals(error, "Invalid email or password");
  });

  await t.step("Authenticate User - Non-existent", async () => {
    const { ok, error } = await authenticateUser(
      "nobody@example.com",
      "anypass",
    );
    assertEquals(ok, false);
    assertEquals(error, "Invalid email or password");
  });

  // Cleanup
  await cleanup(testEmail);
});
