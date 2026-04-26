# Deno KV Feature Wishlist

A collection of limitations and requested features for Deno KV encountered
during the development of InnoKV.

### 1. TTL / Expiration Introspection

Currently, `Deno.KvEntry` does not expose the `expiresAt` or remaining TTL for a
record.

- **Use Case**: Management tools cannot show users when a record will expire or
  allow them to "renew" a record's TTL without rewriting the entire value.

### 2. Partial / Mid-Key Prefix Filtering

While `prefix` filtering exists, there is no native way to perform "wildcard"
matches in the middle of a key (e.g., `["user", *, "profile"]`).

- **Use Case**: Filtering records by a specific attribute that is not the
  primary prefix. Currently, this requires maintaining separate indexes or
  performing expensive full-scans.
- **Note**: This is likely constrained by the underlying FoundationDB/SQLite key
  structure, but even basic "glob" support for key parts would be a significant
  performance win.

### 3. Native Key Checkpointing / Skip Scan

Efficiently retrieving unique "top-level" keys under a deep prefix (e.g.,
listing all unique `user_id`s in `["users", user_id, "data", ...]`) currently
requires manual "skip scan" logic (listing `limit: 1` then starting the next
list at the next possible prefix).

- **Use Case**: Tree-based KV explorers and analytics tools. A native
  `kv.listUniqueParts({ prefix: ["users"], depth: 1 })` would be much more
  efficient.

### 4. Atomic Transaction Limits

The 1000 mutation limit per `atomic()` transaction is restrictive for bulk
operations (migration, import/export).

- **Use Case**: Moving large prefixes (>1000 records) requires manual chunking
  and increases the risk of partial failures. A higher limit or "super-atomic"
  migration API would be useful.

### 5. Native Import/Export & Backup Tooling

There is currently no official, high-fidelity CLI tool for importing/exporting
Deno KV data (especially between local SQLite and remote Deno Deploy).

- **Use Case**: Disaster recovery, local-to-cloud migration, and
  staging-to-production sync. While tools like InnoKV implement this via
  `kv.list()` and `kv.set()`, a native `deno kv export` and `deno kv import`
  would handle the internal V8 serialization more efficiently and could
  potentially support "point-in-time" exports for larger datasets.

### 6. Queue Visibility & Management

Deno KV supports `enqueue()` and `listenQueue()`, but the queue itself is a
"black box" to the developer.

- **Use Case**: Management tools cannot currently display the number of pending
  tasks, inspect job payloads, or cancel stuck jobs. Native support for
  `kv.listQueue()` would be a major win for observability.

### 7. Enhanced `watch()` Capabilities

The current `watch()` API is limited to 10 specific keys and doesn't support
prefixes.

- **Use Case**: A "Live View" in a management tool currently requires polling or
  10-key chunks. Native prefix-based watching (e.g.,
  `kv.watchPrefix(["users"])`) would enable real-time dashboards for entire data
  namespaces.
