# Changelog

All notable changes to this project will be documented in this file.

## v0.4.1-dev.4

- **Fixed JSR Asset Loading**: Implemented a "JSR Asset Bridge" middleware to resolve 500 errors when running from a JSR package. This ensures that UI assets (JS/CSS) and static files are correctly served from the JSR cache using Deno's `fetch` API.
- **Improved CLI Commands**: Standardized `deno install` flags in documentation for better compatibility.

## v0.4.0

- **Lightweight Installation**: Added support for `deno install`. Users can now
  install a ~6MB lightweight version that uses their local Deno runtime,
  significantly reducing download size.
- **Official JSR Support**: InnoKV is now officially available on JSR. The web
  UI is now bundled directly into the package for a seamless experience.
- **Improved Stability**: Fixed a crash that occurred when analyzing database
  statistics for certain key structures.
- **Better Type Support**: Hardened the system to ensure complex Deno KV types
  like `BigInt`, `Date`, and `Uint8Array` are preserved and displayed correctly
  across the UI and CLI.

## v0.3.5

- **Halved Executable Size**: Resolved a regression from the `v0.3.x` releases
  where the standalone executable size had accidentally ballooned to over 200MB.
  Binaries for all platforms are now back to their lean, standard size (~100MB),
  resulting in much faster download times and a reduced disk footprint.

## v0.3.4

- **Fix Compiled Binary**: Restored CLI + server dual-mode support in compiled
  binaries. All v0.3.0–v0.3.3 binaries were broken (always started the server,
  CLI commands were unreachable). The compiled entrypoint now routes through the
  CLI parser, with the server as the default action.
- **Fix Release Workflow**: Removed non-existent `innokv` artifact from GitHub
  release uploads.

## v0.3.3

- **Fix JSR Migration Loading**: Switched to static imports for internal
  migrations to fix 'URL must be a file URL' errors when running from JSR or
  other remote module environments.

## v0.3.1

- **JSR Publication Hardening**:
  - Resolved all publication blockers: missing version constraints, external
    `https` imports, and restricted triple-slash directives.

## v0.3.0

> [!CAUTION]
> **Breaking Change**: The representation of binary data (`Uint8Array`) has been
> standardized to a numeric array format. JSON exports before v0.3.0 are no
> longer compatible and must be re-exported.

- **New JSR Submodules**:
  - `@innovatedev/innokv/migrations`: A generic, standalone KV migration engine.
  - `@innovatedev/innokv/codec`: Unified serialization layer for keys and
    values.
- **Unified URL State**: Navigation paths and search queries are now
  synchronized with the URL, enabling bookmarking and browser back/forward
  button support.
- **Improved Search UI**: New direct toggles for search modes (Regex, Case
  Sensitive, Target) and support for binary key matching (e.g., `u8[1,2,3]`).
- **Rapid Navigation**: Breadcrumb items now feature context menus for quick
  actions (Refresh, Move, Duplicate, Delete) without using the sidebar.
- **Enhanced Portability**: Improved reliability for cross-database
  moves/copies, including the ability to move records directly to the database
  root.
- **Bulk Operations**: Perform recursive moves, duplications, and deletions on
  multiple selected records or entire path prefixes.
- **UX & Documentation**: Overhauled `README.md` and standardized server port
  (4665).

## v0.2.0

- **Recursive Operations**: Move, copy, and delete entire KV paths recursively
  from both UI and CLI.
- **Bulk Data Management**:
  - **Selective Export**: Export selected records or all matching entries to
    JSON from the Web UI.
  - **JSON Migration**: Import and export large datasets via CLI or UI to
    facilitate database migrations.
- **Global Configuration**:
  - New `config` CLI command to manage persistent server settings (port, cookie
    name).
  - Added interactive mode to `config` command for easy guided setup.
- **CLI Enhancements**:
  - New `tree` command for visual hierarchical inspection of KV data.
  - Refined `rm` command with safety prompts including record counts and
    `--force` support.
- **Improved UI/UX**:
  - Integrated Read-Only indicators with tooltips across Sidebar, Breadcrumbs,
    and Dashboard.
  - New "Move / Rename" dialog with recursive support and type-safe key part
    editor.
- **System & Stability**:
  - Migrated configuration paths to OS-standard locations (XDG on Linux).
  - Robust `Uint8Array` binary key support across all layers (URL, Tree View,
    API).
  - Fixed database edit form data loss bug.

## v0.1.3

- upgrade to `@innovatedev/fresh-session@0.5.1` (stable)
- implement strictly typed `defineAuth` pattern for authenticated routes
- fix session validation error for legacy sessions missing `lastSeenAt`
- remove redundant type aliases (`UserDoc`, `DatabaseDoc`, etc.) and align
  project with base models
- improve developer documentation for state and utility helpers

## v0.1.2

- migrate to Fresh 2.0 origin-based CSRF protection
- add comprehensive CSRF testing suite
- bump dependencies: fresh to v2.2.2, kvdex to v3.6.5
- add user settings: reset password, manage api tokens
- add granular permissions and api token authorization
- fix windows path issues with routes

## v0.1.1

- fix default database and installation paths across operating systems
- display app/DB info on startup
- fix u8 record key display in database view
- fix entry UI/editor, add JSON editor tab for structure/values
- fix breadcrumb links and initial load for root records
- fix treeview display for items with no sub keys

## v0.1.0

- jsr release

## v0.0.3

- jsr package

## v0.0.2

- unified cli and server
  - ./innokv db # drops to cli
  - ./innokv # starts server

## v0.0.1

- implemented KV database explorer
- Supports file based (sqlite) and remote (deno deploy and
  [seflhosted denokv](https://github.com/denoland/denokv)) deno kv stores
- Deno KV token authorization support
- Web server with deno fresh
- User accounts and permissions
- Binary releases for Linux, Windows and macOS
- CLI tool for managing databases

## v0.0.0

- Deno KV database explorer idea
