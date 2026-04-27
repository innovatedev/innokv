# Fixing Binary Bloat in Deno

If `deno compile` produces a bloated executable (e.g., > 150MB) when building
InnoKV, it usually means web development tools (`vite`, `tailwindcss`,
`esbuild`) were accidentally bundled.

## The Core Rules

1. **Keep `nodeModulesDir: "none"` during compilation.** When
   `nodeModulesDir: "auto"` is active, Deno assumes any `npm:` import could use
   dynamic CJS `require()`. To be safe, it automatically embeds the _entire_
   physical `node_modules` directory (including heavy devDependencies) into the
   binary's VFS.

2. **Use a separate `compile.json`.** Because `deno.json` requires
   `"nodeModulesDir": "auto"` to run `vite` for the web UI, you must use a
   separate `--config compile.json` for `deno compile`. `compile.json` removes
   web dependencies and enforces `"nodeModulesDir": "none"`.

3. **`--exclude node_modules` will crash your binary.** You cannot just use
   `deno.json` and append `--exclude node_modules`. Deno statically rewrites
   imports to point to `node_modules/` during compilation. If you exclude the
   folder, the binary will crash with `[ERR_MODULE_NOT_FOUND]` at runtime.

4. **Isolate CLI code from Web Code.** If _any_ CLI or backend file imports an
   object or type from the frontend framework (e.g.,
   `import { FreshContext } from "fresh"`), Deno's static analyzer will traverse
   that import and drag the entire web framework into the compilation module
   graph.

## Debugging Checklist

If the binary is bloated again, verify the following:

- [ ] Check `compile.json`. Ensure no frontend tools (`vite`, `tailwindcss`,
      `preact`) were accidentally added to its `imports` map.
- [ ] Check `compile.json`. Ensure `"nodeModulesDir": "none"` is strictly set.
- [ ] Check for import leaks. Run `deno info compile-entry.ts`. If you see
      `vite` or `fresh` in the tree, follow the graph to see which backend file
      is importing them and sever the link.
- [ ] Remove unused `--include` flags. Do not pass `--include lib` or
      `--include config` to `deno compile`. The compiler naturally discovers the
      necessary files. Forcing inclusion manually pulls in unreferenced
      web-centric files.
