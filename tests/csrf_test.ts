import server from "../_fresh/server.js";
import { assert, assertEquals } from "jsr:@std/assert@1";

Deno.test({
  name: "CSRF Migration Tests (Origin-based)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async (t) => {
    await t.step("POST /login from same-origin should pass", async () => {
      const res = await server.fetch(
        new Request("http://localhost/login", {
          method: "POST",
          headers: {
            "Origin": "http://localhost",
            "Sec-Fetch-Site": "same-origin",
          },
          body: new FormData(),
        }),
      );
      // Should NOT be 403. Will be 302 because of missing form data.
      assert(res.status !== 403, "Should pass same-origin request");
    });

    await t.step(
      "POST /login from different origin should fail (403)",
      async () => {
        const res = await server.fetch(
          new Request("http://localhost/login", {
            method: "POST",
            headers: {
              "Origin": "http://evil.com",
              "Sec-Fetch-Site": "cross-site",
            },
            body: new FormData(),
          }),
        );
        assertEquals(
          res.status,
          403,
          "Should fail cross-site request with 403 Forbidden",
        );
      },
    );

    await t.step(
      "POST with Authorization header should bypass CSRF even if cross-site",
      async () => {
        const res = await server.fetch(
          new Request("http://localhost/login", {
            method: "POST",
            headers: {
              "Authorization": "Bearer some-token",
              "Origin": "http://evil.com",
              "Sec-Fetch-Site": "cross-site",
            },
            body: new FormData(),
          }),
        );

        // Should bypass CSRF because of the Authorization header check in main.ts
        assert(
          res.status !== 403,
          "Should bypass CSRF with Authorization header",
        );
      },
    );
  },
});
