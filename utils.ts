import { createDefine } from "fresh";
import { Database } from "./lib/models.ts";
import { State as SessionState } from "@innovatedev/fresh-session";
import { UserWithId } from "./lib/users.ts";

// This specifies the type of "ctx.state" which is used to share
// data among middlewares, layouts and routes.
export type State = {
  plugins: {
    kvAdmin: {
      databases: Database[];
    };
    permissions: {
      requires: (permission: string) => void;
      has: (permission: string) => boolean;
    };
  };
} & SessionState<UserWithId>;

export const define = createDefine<State>();
