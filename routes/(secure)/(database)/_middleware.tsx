import { define } from "@/utils.ts";

export const handler = define.middleware((ctx) => {
  ctx.state.plugins.permissions.requires("database:manage");

  return ctx.next();
});
