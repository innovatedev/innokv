import { ComponentChildren } from "preact";
import { UsersIcon } from "../icons/UsersIcon.tsx";
import { AuditLogIcon } from "../icons/AuditLogIcon.tsx";

interface AdminPageProps {
  title: string;
  subtitle?: string;
  children: ComponentChildren;
  currentTab: "users" | "audit-logs" | "settings";
}

export function AdminPage(
  { title, subtitle, children, currentTab }: AdminPageProps,
) {
  const tabs = [
    {
      id: "users",
      name: "Users",
      href: "/admin/users",
      icon: <UsersIcon className="w-4 h-4" />,
    },
    {
      id: "audit-logs",
      name: "Audit Logs",
      href: "/admin/audit-logs",
      icon: <AuditLogIcon className="w-4 h-4" />,
    },
  ];

  return (
    <div class="min-h-screen bg-base-100 flex flex-col">
      {/* Premium Header */}
      <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <a
              href="/"
              class="btn btn-ghost btn-sm btn-circle"
              title="Back to Dashboard"
            >
              &larr;
            </a>
            <div>
              <h1 class="text-lg font-bold flex items-center gap-2">
                <span class="text-brand">Admin</span> / {title}
              </h1>
              {subtitle && (
                <p class="text-xs opacity-50 font-normal">{subtitle}</p>
              )}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="tabs tabs-boxed bg-base-200/50 p-1">
              {tabs.map((tab) => (
                <a
                  key={tab.id}
                  href={tab.href}
                  class={`tab tab-sm gap-2 transition-all ${
                    currentTab === tab.id
                      ? "tab-active bg-primary text-primary-content shadow-sm"
                      : "hover:bg-base-300"
                  }`}
                >
                  {tab.icon}
                  <span class="hidden sm:inline">{tab.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div class="bg-base-100 border border-base-200 rounded-2xl shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
