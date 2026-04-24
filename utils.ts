import {
  createDefineSession,
  State as SessionState,
} from "@innovatedev/fresh-session";
import { Define } from "fresh";
import { Database, SessionData, User } from "@/kv/models.ts";

/**
 * Extra application state to merge into the session state.
 * Includes plugins for KV administration and permissions.
 */
export type ExtraState = {
  plugins: {
    kvAdmin: {
      databases: Database[];
    };
    permissions: {
      requires: (permission: string) => void;
      has: (permission: string) => boolean;
    };
  };
};

/**
 * The standard application state.
 * Use this for public routes or routes that don't require authentication.
 */
export const define = createDefineSession<User, SessionData, ExtraState>();

/**
 * Merged state type for the application.
 */
export type State = SessionState<User, SessionData> & ExtraState;

/**
 * Strictly typed state for authenticated routes.
 * Guaranteed to have `user` and `userId` populated.
 */
export type AuthState = State & {
  userId: string;
  user: User;
};

/**
 * Strictly typed define helper for authenticated routes.
 * Use this in pages and handlers that require a logged-in user.
 *
 * @example
 * ```ts
 * export const handler = defineAuth.handlers({
 *   GET(ctx) {
 *     const user = ctx.state.user; // Strictly typed User
 *     return ctx.next();
 *   }
 * });
 * ```
 */
export const defineAuth = define as Define<AuthState>;
