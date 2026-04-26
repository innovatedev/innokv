import { defineAuth } from "@/utils.ts";
import HomeView from "@/islands/admin/HomeView.tsx";
import { DatabaseProvider } from "@/islands/admin/contexts/DatabaseContext.tsx";
import { UsersIcon } from "@/components/icons/UsersIcon.tsx";
import {
  CheckIcon,
  LogoutIcon,
  UserIcon,
} from "@/components/icons/ActionIcons.tsx";
import { Dropdown } from "@/components/Dropdown.tsx";
import { Database } from "@/kv/models.ts";
import { User } from "@/kv/models.ts";
import BrandHeader from "@/components/BrandHeader.tsx";

import { ComponentChildren } from "preact";

const DBHoC = ({
  databases,
  userSettings,
  children,
}: {
  databases: Database[];
  userSettings: User["settings"];
  children: ComponentChildren;
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

export default defineAuth.page(function Home({ state }) {
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
    userSettings,
  }: {
    children?: ComponentChildren;
    userSettings?: User["settings"];
  }) => {
    return (
      <div class="relative">
        <div class="absolute top-4 right-4 z-50 flex gap-2 items-center">
          {state.plugins.permissions.has("users:manage") && (
            <a
              href="/admin/users"
              class="btn btn-sm btn-ghost hover:bg-brand/20 hover:text-brand gap-2 transition-colors"
            >
              <UsersIcon className="w-4 h-4" />
              Admin
            </a>
          )}
          <Dropdown
            icon={<UserIcon className="w-4 h-4" />}
            label="Account"
          >
            <li class="menu-title px-4 py-2 text-xs font-semibold text-base-content/50 border-b border-base-200 mb-2">
              {userSettings?.hideEmail ? "User" : state.user.email}
            </li>
            <li>
              <a href="/user/tokens">API Tokens</a>
            </li>
            <li>
              <a href="/user/settings">Settings</a>
            </li>
            <div class="divider my-1"></div>
            <li>
              <form
                id="logout-form"
                method="POST"
                action="/logout"
                class="hidden"
              />
              <button
                form="logout-form"
                type="submit"
                class="flex items-center gap-2 text-error hover:text-error"
              >
                <LogoutIcon className="w-4 h-4" />
                Logout
              </button>
            </li>
          </Dropdown>
        </div>
        <div class="flex flex-col w-full max-w-4xl mx-auto p-4 gap-3">
          <div class="mb-8 mt-12">
            <BrandHeader />
          </div>
          {successMessage && (
            <div class="alert alert-success shadow-sm mb-4">
              <CheckIcon className="stroke-current shrink-0 h-6 w-6" />
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
      <DBHoC databases={databases} userSettings={state.user.settings || {}}>
        <HomeViewWrapper userSettings={state.user.settings}>
          <HomeView />
        </HomeViewWrapper>
      </DBHoC>
    );
  }

  return <HomeViewWrapper userSettings={state.user.settings} />;
});
