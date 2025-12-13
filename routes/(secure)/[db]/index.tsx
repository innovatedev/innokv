import { define } from "@/utils.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { db } from "@/lib/db.ts";
import DatabaseView from "@/islands/admin/DatabaseView.tsx";
import { DatabaseProvider } from "@/islands/admin/contexts/DatabaseContext.tsx";

export default define.page(async function DatabasePage({ state, params }) {
  const { databases } = state.plugins.kvAdmin!;
  const dbId = params.db;

  // Server-side Data Fetching for Initial State
  const repo = new DatabaseRepository(db);
  let structure = {};
  let resolvedDbId = dbId;

  try {
    const database = await repo.getDatabaseBySlugOrId(dbId);
    resolvedDbId = database.id;
    structure = await repo.getKeys(resolvedDbId);
  } catch (e) {
    console.error("Failed to fetch database structure", e);
    // Fallback or error handling? We'll render empty structure and let client try or show error.
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
