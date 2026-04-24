# Fresh Utils

This module provides strictly typed Fresh `define` helpers with session and user
state pre-configured.

## Usage

Import the `define` (public) or `defineAuth` (authenticated) helpers into your
routes.

### Public Routes

Use `define` for routes that don't require a logged-in user.

```ts
import { define } from "@/utils.ts";

export default define.page(({ state }) => {
  // state.user and state.userId are optional
  return <h1>Public Page</h1>;
});
```

### Authenticated Routes

Use `defineAuth` for routes that require a logged-in user. `state.user` and
`state.userId` are guaranteed to be present.

```ts
import { defineAuth } from "@/utils.ts";

export const handler = defineAuth.handlers({
  GET(ctx) {
    const user = ctx.state.user; // Strictly typed User
    const userId = ctx.state.userId; // string
    return ctx.next();
  },
});

export default defineAuth.page(({ state }) => {
  return <h1>Welcome, {state.user.email}</h1>;
});
```

## State Definition

The `State` type is a combination of `SessionState` and our `ExtraState`:

```ts
export type ExtraState = {
  plugins: {
    kvAdmin: { databases: Database[] };
    permissions: {
      requires: (permission: string) => void;
      has: (permission: string) => boolean;
    };
  };
};

export type AuthState = State & {
  userId: string;
  user: User;
};
```
