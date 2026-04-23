import { createDefine } from "fresh";
import { Database, Session, User } from "@/kv/models.ts";
import { State as SessionState } from "@innovatedev/fresh-session";

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
  session: Session;
} & SessionState<User>;

export type AuthState = State & {
  userId: string;
  user: User;
};

export const define = createDefine<State>();
export const defineAuth = createDefine<AuthState>();
