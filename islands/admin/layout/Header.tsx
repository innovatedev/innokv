import { useContext, useEffect, useState } from "preact/hooks";
import { DatabaseContext } from "../contexts/DatabaseContext.tsx";

export const Header = () => {
  const { activeDatabase } = useContext(DatabaseContext);

  return (
    <div class={`navbar bg-base-100`}>
      <div class="flex-1">
        <a href="/admin" class="px-2 mx-2">KV Admin</a>
        {activeDatabase && (
          <button type="button" class="btn btn-ghost normal-case text-xl">
            {activeDatabase.name}
          </button>
        )}
      </div>
      <div class={`menu menu-compact lg:hidden p-0`}>
        <label for="menu-toggle" class="btn btn-ghost drawer-button">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 6h16M4 12h16m-7 6h7"></path>
          </svg>
        </label>
      </div>
      <div class="hidden lg:flex flex-none">
        <label for="menu-toggle" class="btn btn-ghost drawer-button">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 6h16M4 12h16m-7 6h7"></path>
          </svg>
        </label>
      </div>
    </div>
  );
};
