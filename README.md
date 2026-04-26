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
innokv
```

Open http://localhost:4665 in your browser. On the first run, the CLI will
prompt you to create an administrative account.

## CLI Usage

InnoKV includes a powerful CLI for managing your databases directly from the
terminal.

### Basic Commands

| Command                 | Description                                         |
| :---------------------- | :-------------------------------------------------- |
| **serve**               | Start the web server (default).                     |
| **db**                  | Manage and connect to databases.                    |
| **ls** / **tree**       | List or visualize keys.                             |
| **get** / **set**       | Read or write individual records.                   |
| **mv** / **cp**         | Move or copy records (supports `-r` for recursion). |
| **rm**                  | Delete records (supports `-r`, `-f`).               |
| **import** / **export** | Bulk data migration via JSON.                       |
| **user**                | Manage administrative users.                        |
| **config**              | Manage global server settings.                      |

Run `innokv --help` for the full list of commands and options.

### CLI Authentication & Security

CLI authentication is primarily designed for **agent access** (automation,
CI/CD, or AI assistants).

> [!IMPORTANT]
> **Read-Only Mode**: When a database is set to "Read Only", all mutation
> operations (set, update, mv, cp, rm, import) are strictly blocked across both
> the Web UI and the CLI.

> [!NOTE]
> The security model assumes that access to the server's local SQLite database
> is controlled. Sensitive information, such as remote KV access tokens and
> connection strings, is stored within the central database to facilitate
> management across multiple sessions and agents.

### Running the Binary

The `innokv` binary works as both the server and the CLI.

```bash
# Start the server (default)
innokv

# Start on a specific port
innokv --port 4665

# Start with a custom session cookie
innokv --cookie-name my_session

# Run a CLI command
innokv db
```

### Examples

**Visual Tree View:**

```bash
innokv tree my-db
# my-db
# └── "users"
#     ├── "alice" (object)
#     └── "bob" (object)
```

**Bulk Operations:**

```bash
# Move ONLY the exact key (Shallow)
innokv mv my-db users/old users/new

# Move a path recursively
innokv mv my-db users/old users/new -r

# Copy a path recursively
innokv cp my-db users/old users/backup -r
```

**JSON Redirection (Import/Export):**

InnoKV supports standard input/output redirection, making it easy to pipe data
between databases or save backups.

**Unix / Linux / macOS (Bash/Zsh):**

```bash
# Export to a file using redirection
innokv export my-db users > users_backup.json

# Import from a file using redirection
innokv import my-db < users_backup.json

# Pipe data directly between databases
innokv export prod-db | innokv import staging-db
```

**Windows (PowerShell):**

```powershell
# Export to a file
innokv export my-db users | Out-File -FilePath users_backup.json -Encoding utf8

# Import from a file
Get-Content users_backup.json | innokv import my-db
```

**Windows (Command Prompt):**

```cmd
# Export to a file
innokv export my-db users > users_backup.json

# Import from a file
innokv import my-db < users_backup.json
```

**Interactive Mode:** In addition to standard navigation, the Web UI supports
**Bulk Export** of selected records or entire folder views, making it easy to
backup specific subsets of your data.

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

# Get keys as a JSON array (for AI agents)
innokv ls my-db users --json

# Get a specific value
innokv get my-db users/admin

# Get full entry (key, value, versionstamp) as JSON
innokv get my-db users/admin --json

# Set a value with native BigInt support
innokv set my-db settings/counter 100n

# Set complex types using Rich Mode (ValueCodec format)
innokv set my-db raw/data '{"type":"Uint8Array","value":[1,2,3]}' --rich

# Update an object (merges by default)
innokv update my-db users/alice '{"lastLogin": "2024-04-24"}'

# Navigate to complex keys (using KeyCodec formatting)
innokv get my-db "users"/123/true/u8[1,2,3]
```

### Rich Type Support & AI/Agent Use

InnoKV is designed for **100% faithful representation** of Deno KV types. This
means that `BigInt`, `Uint8Array`, `Date`, `RegExp`, `Map`, `Set`, and all
`TypedArray` variants are preserved without data loss.

For AI agents and automation, use the `--json` and `--rich` flags:

- **`--json`**: Outputs the entire `Deno.KvEntry` as a machine-readable JSON
  object. The `value` is encoded using a transport-safe "rich" format.
- **`--rich`**:
  - On **get**: Outputs just the value in the rich transport format.
  - On **set** / **update**: Parses the input string as a rich transport object,
    allowing you to write types that standard JSON doesn't support (like
    `BigInt` or `Uint8Array`).

Example Rich Format:

```json
{
  "type": "bigint",
  "value": "900719925474099100"
}
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## Security Issues

Report any security related issues to security@innovate.dev
