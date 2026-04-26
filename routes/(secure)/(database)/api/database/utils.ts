import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";
import { RichValue } from "@/lib/ValueCodec.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  POST: (ctx) =>
    db.handleApiCall(ctx, (rawData) => {
      const data = rawData as {
        action: string;
        value?: RichValue;
      };
      const { action, value } = data;

      if (action === "calculate-size") {
        if (!value) throw new Error("Value is required");
        return Promise.resolve({ size: db.calculateValueSize(value) });
      }

      throw new Error(`Unknown action: ${action}`);
    }),
});
