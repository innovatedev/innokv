# InnoKV

Deno KV admin/management tool. Connect to local or remote Deno KV and manage
your Deno KV data stores.

## AI Transparency

⚠️ This project is primarily AI-assisted (Antigravity, Copilot, Cursor, Gemini,
ChatGPT, Composer, Claude, Grok); all code is directed, reviewed, and tested by
humans.

## Quick Start

```bash
deno run -A --unstable-kv jsr:@innovatedev/innokv install
```

### Server

```bash
ADMIN_EMAILS=test@example.com innokv
```

Open http://localhost:8000 in your browser. Register and login with an email
address matching the `ADMIN_EMAILS` environment variable.

## CLI Usage

InnoKV includes a powerful CLI for managing your databases directly from the
terminal.

### Commands

| Command              | Usage              | Description                   |
| :------------------- | :----------------- | :---------------------------- |
| **List Databases**   | `db`               | List all available databases. |
| **Interactive REPL** | `repl [slug]`      | Start an interactive shell.   |
| **List Keys**        | `ls <slug> [path]` | List keys in a database.      |
| **Get Value**        | `get <slug> <key>` | Get the value of a key.       |

### Running the Binary

The `innokv` binary works as both the server and the CLI.

```bash
# Start the server (default)
innokv

# Run a CLI command
innokv db
```

### Examples

**List all databases:**

```bash
innokv db
```

**Interactive Mode:**

```bash
innokv repl my-db
# > ls
# > get users/admin
# > cd users
# > ls
```

**Quick Key Inspection:**

```bash
# List keys in 'users' path
innokv ls my-db users

# Get a specific value
innokv get my-db users/admin

# Navigate to a Uint8Array key
innokv get my-db u8[1,2,3]
```

## Security Issues

Report any security related issues to security@innovate.dev
