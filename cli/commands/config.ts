import { Command } from "@cliffy/command";
import { db } from "@/kv/db.ts";
import { AppConfig } from "@/kv/models.ts";
import { Input, Number, Select } from "@cliffy/prompt";

/**
 * Command to manage global InnoKV configuration.
 */
export const configCmd = new Command()
  .description("Manage global InnoKV configuration")
  .action(async () => {
    // Only run interactive if no subcommands were passed
    if (
      Deno.args.includes("ls") || Deno.args.includes("set") ||
      Deno.args.includes("get") || Deno.args.includes("reset")
    ) {
      return;
    }

    console.log("--- InnoKV Global Configuration ---");
    const configDoc = await db.config.find("global");
    const current = (configDoc?.flat() || {
      id: "global",
      updatedAt: new Date(),
    }) as AppConfig;

    const action = await Select.prompt<string>({
      message: "What would you like to do?",
      options: [
        { name: "List Settings", value: "ls" },
        { name: "Set Port", value: "port" },
        { name: "Set Cookie Name", value: "cookieName" },
        { name: "Reset to Defaults", value: "reset" },
        { name: "Exit", value: "exit" },
      ],
    });

    if (action === "exit") return;

    if (action === "ls") {
      console.table(current);
      return;
    }

    if (action === "reset") {
      await db.config.delete("global");
      console.log("✅ Global configuration reset to defaults.");
      return;
    }

    // deno-lint-ignore no-explicit-any
    const next: any = { ...current, updatedAt: new Date() };

    if (action === "port") {
      next.port = await Number.prompt({
        message: "Enter port number",
        default: current.port || 8000,
      });
    } else if (action === "cookieName") {
      next.cookieName = await Input.prompt({
        message: "Enter session cookie name",
        default: current.cookieName || "innokv.sid",
      });
    }

    delete next.id;
    delete next.versionstamp;

    await db.config.delete("global");
    await db.config.set("global", next);
    console.log(`✅ Configuration updated.`);
  })
  .command("ls", "List all configuration settings")
  .action(async () => {
    const configDoc = await db.config.find("global");
    if (!configDoc) {
      console.log("No global configuration set. Using defaults.");
      return;
    }
    console.log("Global Configuration:");
    console.table(configDoc.flat());
  })
  .command("set <key:string> <value:string>")
  .description("Set a configuration value")
  .action(async (_options, key, value) => {
    const configDoc = await db.config.find("global");
    const current = configDoc?.flat() ||
      { id: "global", updatedAt: new Date() };

    // deno-lint-ignore no-explicit-any
    const next: any = { ...current, updatedAt: new Date() };

    if (key === "port") {
      next.port = parseInt(value);
    } else if (key === "cookieName") {
      next.cookieName = value;
    } else {
      console.error(`Unknown config key: ${key}`);
      Deno.exit(1);
    }

    delete next.id;
    delete next.versionstamp;

    await db.config.delete("global");
    await db.config.set("global", next);
    console.log(`✅ Set ${key} = ${value}`);
  })
  .command("get <key:string>")
  .description("Get a configuration value")
  .action(async (_options, key) => {
    const configDoc = await db.config.find("global");
    if (!configDoc) {
      console.log(`Config ${key} is not set.`);
      return;
    }
    // deno-lint-ignore no-explicit-any
    console.log((configDoc.flat() as any)[key] ?? "Not set");
  })
  .command("reset")
  .description("Reset global configuration to defaults")
  .action(async () => {
    await db.config.delete("global");
    console.log("✅ Global configuration reset to defaults.");
  });
