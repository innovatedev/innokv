import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

import { parse } from "@std/jsonc";

const configText = Deno.readTextFileSync("./deno.jsonc");
const config = parse(configText) as { version?: string };
const version = config.version || "0.0.0";

export default defineConfig({
  plugins: [fresh(), tailwindcss()],
  define: {
    "import.meta.env.APP_VERSION": JSON.stringify(version),
  },
  server: {
    port: 5177,
    watch: {
      ignored: ["**/innokv-data/**"],
    },
  },
});
