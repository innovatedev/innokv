import { dirname } from "https://deno.land/std@0.224.0/path/mod.ts";
import { getDefaultConfigPath } from "@/lib/paths.ts";

export interface CliConfig {
  token?: string;
  email?: string;
}

function getConfigPath(): string {
  return getDefaultConfigPath();
}

export async function readConfig(): Promise<CliConfig> {
  try {
    const text = await Deno.readTextFile(getConfigPath());
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function writeConfig(config: CliConfig) {
  const path = getConfigPath();
  try {
    await Deno.mkdir(dirname(path), { recursive: true });
  } catch (_) { /* ignore */ }
  await Deno.writeTextFile(path, JSON.stringify(config, null, 2));
}

export async function deleteConfig() {
  try {
    await Deno.remove(getConfigPath());
  } catch {
    // Ignore if not exists
  }
}
