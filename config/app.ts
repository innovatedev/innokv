import { getDefaultDbPath } from "@/lib/paths.ts";

const settings = {
  db: {
    path: getDefaultDbPath(),
  },
  server: {
    port: parseInt(Deno.env.get("PORT") ?? "8000"),
    cookieName: Deno.env.get("SESSION_COOKIE_NAME") ?? "innokv.sid",
  },
  admin: {
    emails: (Deno.env.get("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0),
  },
  env: {
    isProd: Deno.env.get("DENO_ENV") === "production" ||
      Deno.env.get("NODE_ENV") === "production",
  },
};

export default settings;
