import { app } from "../main.ts";
import { assert } from "jsr:@std/assert@1";

/**
 * Integration test to ensure the server starts and can handle basic requests.
 * This catches validation errors in middleware (like Arktype session validation).
 */
Deno.test({
  name: "Server - Start and handle basic request",
  async fn() {
    try {
      // Fresh 2.x handler
      const handler = app.handler();

      // We test the root path which usually involves session initialization
      const req = new Request("http://localhost/");

      const resp = await handler(req);

      console.log(`Response status: ${resp.status}`);

      // We expect a successful response or a redirect (302) to login
      // A 500 error indicates a server-side crash (e.g. validation error)
      assert(resp.status < 500, `Server crashed with status ${resp.status}`);
    } catch (e) {
      // If we are missing the _fresh directory, we might get an error
      // In a real CI environment, we should run 'deno task build' first
      if (
        e instanceof Error &&
        e.message?.includes("Could not find _fresh directory")
      ) {
        console.warn(
          "Test Note: _fresh directory missing, skipping full integration. Run 'deno task build' to enable.",
        );
        return;
      }
      throw e;
    }
  },
  // Skip resource/ops sanitization because kv/db.ts opens a global KV instance
  // that isn't closed until the process exits.
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Server - Handle API request",
  async fn() {
    try {
      const handler = app.handler();
      const req = new Request("http://localhost/api/databases");

      const resp = await handler(req);
      console.log(`API Response status: ${resp.status}`);
      assert(resp.status < 500, `API crashed with status ${resp.status}`);
    } catch (e) {
      if (
        e instanceof Error &&
        e.message?.includes("Could not find _fresh directory")
      ) return;
      throw e;
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
