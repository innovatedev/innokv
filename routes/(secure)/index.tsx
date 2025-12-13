import { define } from "@/utils.ts";
import HomeView from "../../islands/admin/HomeView.tsx";
import { DatabaseProvider } from "../../islands/admin/contexts/DatabaseContext.tsx";

export default define.page(function Home({ state }) {
  const { databases } = state.plugins.kvAdmin!;

  return (
    <DatabaseProvider
      initialDatabases={databases}
      initialUserSettings={state.user?.settings}
    >
      <div class="relative">
        <div class="absolute top-4 right-4 z-50">
          <a
            href="/logout"
            class="btn btn-sm btn-ghost hover:bg-brand/20 hover:text-brand gap-2 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Logout
          </a>
        </div>
        <HomeView />
      </div>
    </DatabaseProvider>
  );
});
