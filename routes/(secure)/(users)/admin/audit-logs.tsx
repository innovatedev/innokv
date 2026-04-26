import { defineAuth } from "@/utils.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import AuditLogsView from "@/islands/admin/AuditLogsView.tsx";
import { UsersIcon } from "@/components/icons/UsersIcon.tsx";

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
    <div class="min-h-screen bg-base-100 text-base-content p-8">
      <div class="max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold flex items-center gap-3">
            <span class="text-brand">Audit</span> Logs
          </h1>
          <div class="flex gap-2">
            <a href="/admin/users" class="btn btn-ghost gap-2">
              <UsersIcon className="w-4 h-4" />
              Users
            </a>
            <a href="/" class="btn btn-ghost gap-2">
              &larr; Back
            </a>
          </div>
        </div>

        <AuditLogsView
          initialLogs={logs.map((l) => ({ id: l.id, ...l.value }))}
          databases={databases}
        />
      </div>
    </div>
  );
});
