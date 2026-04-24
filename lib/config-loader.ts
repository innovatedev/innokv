import { db } from "@/kv/db.ts";
import settings from "@/config/app.ts";

/**
 * Loads global configuration from the internal KV and applies it to the app settings.
 * CLI options take precedence over KV settings.
 */
export async function loadGlobalConfig(
  overrides?: { port?: number; cookieName?: string },
) {
  const configDoc = await db.config.find("global");
  const config = configDoc?.flat();

  if (config) {
    if (config.port) settings.server.port = config.port;
    if (config.cookieName) settings.server.cookieName = config.cookieName;
  }

  if (overrides) {
    if (overrides.port) settings.server.port = overrides.port;
    if (overrides.cookieName) settings.server.cookieName = overrides.cookieName;
  }
}
