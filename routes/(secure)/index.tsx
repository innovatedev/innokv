import { define } from "@/utils.ts";
import HomeView from "@/islands/admin/HomeView.tsx";
import { DatabaseProvider } from "@/islands/admin/contexts/DatabaseContext.tsx";
import { UsersIcon } from "@/components/icons/UsersIcon.tsx";
import { LogoutIcon } from "@/components/icons/LogoutIcon.tsx";
import { Database } from "@/lib/models.ts";
import { User } from "@/lib/models.ts";
import BrandHeader from "@/components/BrandHeader.tsx";

const DBHoC = ({
  databases,
  userSettings,
  children,
}: {
  databases: Database[];
  userSettings: User["settings"];
  children: React.ReactNode;
}) => {
  return (
    <DatabaseProvider
      initialDatabases={databases}
      initialUserSettings={userSettings}
    >
      {children}
    </DatabaseProvider>
  );
};

export default define.page(function Home({ state }) {
  const { databases } = state.plugins.kvAdmin!;
  const successMessage = state.flash("success") as string | undefined;

  // Explicitly clear the flash message to ensure it doesn't persist
  // This workaround addresses a potential issue where reading doesn't auto-clear
  if (successMessage) {
    // Attempt to clear by setting to undefined or call without args if supported?
    // Usually setting to null/undefined clears it.
    state.flash("success", undefined);
  }

  const HomeViewWrapper = ({
    children,
  }: {
    children?: React.ReactNode;
  }) => {
    return (
      <div class="relative">
        <div class="absolute top-4 right-4 z-50 flex gap-2">
          {state.plugins.permissions.has("users:manage") && (
            <a
              href="/admin/users"
              class="btn btn-sm btn-ghost hover:bg-brand/20 hover:text-brand gap-2 transition-colors"
            >
              <UsersIcon class="w-4 h-4" />
              Admin
            </a>
          )}
          <a
            href="/logout"
            class="btn btn-sm btn-ghost hover:bg-brand/20 hover:text-brand gap-2 transition-colors"
          >
            <LogoutIcon class="w-4 h-4" />
            Logout
          </a>
        </div>
        <div class="flex flex-col w-full max-w-4xl mx-auto p-4 gap-3">
          <div class="mb-8 mt-12">
            <BrandHeader />
          </div>
          {successMessage && (
            <div class="alert alert-success shadow-sm mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}
          {children}
        </div>
      </div>
    );
  };

  if (state.plugins.permissions.has("database:manage")) {
    return (
      <DBHoC databases={databases} userSettings={state.user?.settings!}>
        <HomeViewWrapper>
          <HomeView />
        </HomeViewWrapper>
      </DBHoC>
    );
  }

  return <HomeViewWrapper></HomeViewWrapper>;
});
