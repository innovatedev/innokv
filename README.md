# InnoKV

**Development workspace and admin tool for Deno KV.**

InnoKV is a professional management interface and CLI for working with real Deno
KV systems across environments.

- Connect to **local, remote, or in-memory** databases
- Inspect and edit data with **full type fidelity** (no JSON flattening)
- Move, copy, and migrate **entire keyspaces or subtrees**
- Compare environments and debug issues **without writing scripts**
- Built for both **humans and automation (CLI + agents)**

If you’re using Deno KV beyond trivial data, InnoKV helps you understand,
manage, and evolve your data safely.

---

## AI Transparency

⚠️ This project is heavily AI-assisted (Antigravity, Copilot, Cursor, Gemini,
ChatGPT, Composer, Claude, Grok). All code is directed, reviewed, and tested by
humans.

---

## Quick Start

```bash
# 1. Install the CLI
deno run -A --unstable-kv jsr:@innovatedev/innokv install

# 2. Start the Server
innokv serve

# 3. Open the UI
# http://localhost:4665
```

---

## Key Features

- **Type Fidelity**: Preserves `BigInt`, `Uint8Array`, `Date`, `Map`, `Set`, and
  more.
- **Visual Explorer**: Tree and flat views for intuitive data navigation.
- **Recursive Operations**: Move, copy, or delete entire branches across
  databases.
- **Bulk Migration**: High-performance JSON import/export with pipe support.
- **Multi-Database Workflow**: Manage dev, test, prod, and scratch side-by-side.
- **Security**: Granular permission system for administrative users and API
  agents.

---

## Why InnoKV?

Deno KV is extremely flexible—but that flexibility comes with real complexity:

- Keys are structured (not just strings)
- Values are rich types (not just JSON)
- No built-in way to explore or compare environments
- Debugging often requires one-off scripts

InnoKV provides a **type-safe, structure-aware interface** for working with KV
data directly.

### Core principles

- **Faithful to data** — no lossy conversions or hidden coercion
- **Structured operations** — work with subtrees, not just individual keys
- **Safe mutation** — understand changes before they happen
- **Automation-ready** — CLI + JSON modes for scripting and AI agents

---

## CLI Reference

| Command                    | Description                                   |
| :------------------------- | :-------------------------------------------- |
| `serve`                    | Start the Web UI and API server.              |
| `ls <db> [path]`           | List keys at a specific path.                 |
| `tree <db> [path]`         | Visualize keys in a tree structure.           |
| `get <db> <path>`          | Retrieve a record (use `--rich` or `--json`). |
| `set <db> <path> <val>`    | Create or overwrite a record.                 |
| `update <db> <path> <val>` | Merge or update an existing record.           |
| `mv/cp <db> <src> <dest>`  | Move or copy records (`-r` for recursion).    |
| `rm <db> <path>`           | Delete records (`-r` for recursion).          |
| `import/export`            | Bulk JSON operations.                         |

Run `innokv --help` for full usage.

---

## The "Rich Mode" Standard

Standard JSON cannot represent many Deno KV types (like `BigInt` or
`Uint8Array`). InnoKV solves this with **Rich Mode**—a transport format for
preserving all Deno KV data types.

### Using `--rich`

```bash
# Set a Uint8Array
innokv set my-db raw/bytes '{"type":"Uint8Array","value":[1,2,3]}' --rich

# Get a value in Rich Format
innokv get my-db raw/bytes --rich
# {"type":"Uint8Array","value":[1,2,3]}

# Update an object
innokv update my-db users/alice '{"lastLogin": "2024-04-26"}'
```

### Using `--json`

Returns full `Deno.KvEntry` (including `versionstamp`) with value encoded in
Rich Format. Recommended for automation and AI agents.

---

## Advanced Usage

### Path Syntax

```bash
innokv get my-db "users"/123/true/u8[1,2,3]
```

### Piping Data

```bash
innokv export prod-db | innokv import local-db
```

---

## Packages

InnoKV also exposes reusable libraries for working with Deno KV outside of the
UI.

### codec/

Utilities for encoding and decoding Deno KV data:

- **KeyCodec** — deterministic key ↔ path transformations
- **ValueCodec** — full-fidelity serialization of all Deno KV types
- **KeySerialization** — transport-safe key formats
- **Types** — `ApiKvKey`, `RichValue`, and core types

---

### migrations/

Generic KV migration engine, independent of InnoKV internals.

- Works with any key structure via optional `parsePath`
- Supports arbitrary key parsing conventions

```ts
import { ... } from "@innovatedev/innokv/migrations"
```

---

## Security & Auth

> **Read-Only Databases**: When a database is marked read-only, all mutation
> commands (`set`, `update`, `mv`, `rm`, etc.) are blocked at the API level.

### Authentication

The CLI uses token-based authentication. Run:

```bash
innokv login
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

---

## Security Issues

Report security issues to [security@innovate.dev](mailto:security@innovate.dev)
