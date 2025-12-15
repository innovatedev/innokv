import { define } from "@/utils.ts";
import { db } from "@/lib/db.ts";
import { HttpError } from "fresh";
import { deepMerge } from "@std/collections";

export const handler = define.handlers({
  async PATCH(ctx) {
    if (!ctx.state.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const body = await ctx.req.json();
    // We need to find the actual KV ID (kvdex ID) not the user.id (UUID)
    // Because we removed the 'id' primary index, we rely on email which is primary.
    const userDoc = await db.users.findByPrimaryIndex(
      "email",
      ctx.state.user.email,
    );

    if (!userDoc) {
      throw new HttpError(401, "User not found");
    }

    const kvId = userDoc.id; // This is the ULID
    const currentSettings = userDoc.value.settings || {};

    const newSettings = deepMerge(currentSettings, body);

    await db.users.update(kvId, {
      settings: newSettings,
    });

    return new Response(JSON.stringify({ settings: newSettings }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
