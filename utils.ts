import { createDefine } from "fresh";
import { Database } from "./lib/models.ts";
import { State as SessionState } from "@innovatedev/fresh-session";
import { User } from "./lib/models.ts";

// This specifies the type of "ctx.state" which is used to share
// data among middlewares, layouts and routes.
export type State = {
  plugins: {
    kvAdmin: {
      databases: Database[];
    };
  };
} & SessionState<User>;

export const define = createDefine<State>();
