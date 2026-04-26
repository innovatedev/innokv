import { getDefaultDbPath } from "@/lib/paths.ts";

const settings = {
  db: {
    path: getDefaultDbPath(),
  },
  allowRegistration: Deno.env.get("ALLOW_REGISTRATION") !== "false",
  server: {
    port: parseInt(Deno.env.get("PORT") ?? "4665"),
    cookieName: Deno.env.get("SESSION_COOKIE_NAME") ?? "innokv.sid",
  },
  env: {
    isProd: Deno.env.get("DENO_ENV") === "production" ||
      Deno.env.get("NODE_ENV") === "production",
  },
};

export default settings;
