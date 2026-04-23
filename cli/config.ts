import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

export interface CliConfig {
  token?: string;
  email?: string;
}

function getConfigPath(): string {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
  return join(home, ".innokv", "config.json");
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
  await Deno.writeTextFile(path, JSON.stringify(config, null, 2));
}

export async function deleteConfig() {
  try {
    await Deno.remove(getConfigPath());
  } catch {
    // Ignore if not exists
  }
}
