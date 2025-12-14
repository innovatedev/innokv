import { define } from "@/utils.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { db } from "@/lib/db.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { DbNode } from "@/lib/types.ts";
import DatabaseView from "@/islands/admin/DatabaseView.tsx";
import { DatabaseProvider } from "@/islands/admin/contexts/DatabaseContext.tsx";

export default define.page(async function DatabasePage({ state, params }) {
  const { databases } = state.plugins.kvAdmin!;
  const dbId = params.db;

  // Server-side Data Fetching for Initial State
  const repo = new DatabaseRepository(db);
  const structure: Record<string, DbNode> = {};
  let resolvedDbId = dbId;

  try {
    const database = await repo.getDatabaseBySlugOrId(dbId);
    resolvedDbId = database.id;
    const { nodes } = await repo.getNodes(resolvedDbId, [], { limit: 1000 });

    // Convert array to Record keyed by encoded key (same as API)
    for (const node of nodes) {
      const mapKey = KeyCodec.encode([node]);
      structure[mapKey] = node;
    }
  } catch (e) {
    console.error("Failed to fetch database structure", e);
  }

  return (
    <DatabaseProvider
      initialDatabases={databases}
      initialSelectedDatabase={resolvedDbId}
      initialUserSettings={state.user?.settings}
    >
      <DatabaseView initialStructure={structure} />
    </DatabaseProvider>
  );
});
