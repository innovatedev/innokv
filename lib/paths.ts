import { join } from "@std/path";

export function getDefaultDbPath(): string {
  const envPath = Deno.env.get("INNOKV_DB_PATH");
  if (envPath) return envPath;

  const os = Deno.build.os;
  const home = Deno.env.get("HOME") || ".";

  switch (os) {
    case "windows": {
      const localAppData = Deno.env.get("LOCALAPPDATA") ||
        join(Deno.env.get("USERPROFILE") || ".", "AppData", "Local");
      return join(localAppData, "innokv", "db.kv");
    }
    case "darwin":
      return join(home, "Library", "Application Support", "innokv", "db.kv");
    default: {
      // Linux / Unix - XDG standard
      const xdgDataHome = Deno.env.get("XDG_DATA_HOME");
      if (xdgDataHome) {
        return join(xdgDataHome, "innokv", "db.kv");
      }
      return join(home, ".local", "share", "innokv", "db.kv");
    }
  }
}
