# Changelog

All notable changes to this project will be documented in this file.

## v0.2.0 (2026-04-24)

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
  - Added `-p, --port` and `--cookie-name` flags to the main command for easy
    local development.
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
- update `utils.ts` JSDoc with modern usage examples

## v0.1.2

- migrate to Fresh 2.0 origin-based CSRF protection
- add comprehensive CSRF testing suite
- bump dependencies:
  - fresh to v2.2.2
  - kvdex to v3.6.5
  - fresh-session to v0.5.0-alpha.2
- fix stylesheet 404
- add user settings
  - reset password
  - manage api tokens
- add granular permissions
- add api token authorization
- fix windows path issues with routes

## v0.1.1

- fix default database and installation paths across operating systems
- display app/DB info on startup
- fix u8 record key display in database view
- fix entry UI/editor, add JSON editor tab for structure/values
- fix breadcrumb links
- fix initial load for root records
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
