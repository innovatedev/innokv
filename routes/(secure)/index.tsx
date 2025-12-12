import { define } from "@/utils.ts";
import HomeView from "../../islands/admin/HomeView.tsx";
import { DatabaseProvider } from "../../islands/admin/contexts/DatabaseContext.tsx";

export default define.page(function Home({ state }) {
  const { databases } = state.plugins.kvAdmin!;

  return (
    <DatabaseProvider initialDatabases={databases}>
      <HomeView />
    </DatabaseProvider>
  );
});
