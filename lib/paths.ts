import { join } from "@std/path";

/**
 * Returns the base directory for InnoKV data based on the OS.
 */
function getBaseDir(): string {
  const os = Deno.build.os;
  const home = Deno.env.get("HOME") || ".";

  switch (os) {
    case "windows": {
      return Deno.env.get("LOCALAPPDATA") ||
        join(Deno.env.get("USERPROFILE") || ".", "AppData", "Local");
    }
    case "darwin":
      return join(home, "Library", "Application Support");
    default: {
      // Linux / Unix - XDG standard
      return Deno.env.get("XDG_DATA_HOME") || join(home, ".local", "share");
    }
  }
}

export function getDefaultDbPath(): string {
  const envPath = Deno.env.get("INNOKV_DB_PATH");
  if (envPath) return envPath;

  return join(getBaseDir(), "innokv", "db.kv");
}

export function getDefaultConfigPath(): string {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
  const os = Deno.build.os;

  if (os === "windows") {
    return join(getBaseDir(), "innokv", "config.json");
  }

  // Use XDG_CONFIG_HOME for Linux/Unix/macOS config
  const xdgConfig = Deno.env.get("XDG_CONFIG_HOME");
  if (xdgConfig) {
    return join(xdgConfig, "innokv", "config.json");
  }

  // macOS standard for config is also often in Application Support,
  // but many CLI tools use ~/.config/innokv on Mac too.
  // We'll stick to ~/.config as the default fallback for non-Windows.
  return join(home, ".config", "innokv", "config.json");
}
