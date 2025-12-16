import { getDefaultDbPath } from "@/lib/paths.ts";

const settings = {
  db: {
    path: getDefaultDbPath(),
  },
  admin: {
    emails: (Deno.env.get("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0),
  },
};

export default settings;
