import { defineAuth } from "@/utils.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import AuditLogsView from "@/islands/admin/AuditLogsView.tsx";
import { AdminPage } from "@/components/admin/AdminPage.tsx";

export default defineAuth.page(async function AdminAuditLogs({ state }) {
  const dbRepo = new DatabaseRepository(kvdex);

  // Ensure the user has admin permissions to view audit logs
  state.plugins.permissions.requires("admin:audit_logs");

  const { result: logs } = await dbRepo.getAuditLogs({ limit: 100 });
  const databasesRes = await dbRepo.getDatabases();
  const databases = databasesRes.result.map((d) => ({
    id: d.id,
    name: d.value.name,
  }));

  return (
    <AdminPage
      title="Audit Logs"
      subtitle="Track all data mutations and system events"
      currentTab="audit-logs"
    >
      <div class="p-6">
        <AuditLogsView
          initialLogs={logs.map((l) => ({ id: l.id, ...l.value }))}
          databases={databases}
        />
      </div>
    </AdminPage>
  );
});
