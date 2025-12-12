import { db } from "./db.ts";
import { json } from "./http.ts";
import { FreshContext } from "fresh";

export class DatabaseError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class BaseRepository {
  constructor(protected kvdex: typeof db) {
    // Automatically bind all methods to the instance
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const value = this[key];
      if (typeof value === "function" && key !== "constructor") {
        this[key] = value.bind(this);
      }
    }
  }

  protected parseModel<T>(model: (data: any) => T, data: any): T {
    return model.parse(data);
  }

  async handleApiCall<T>(
    ctx: FreshContext,
    callback: (data: any) => Promise<T>,
  ): Promise<Response> {
    try {
      const data = ["POST", "DELETE", "PATCH", "PUT"].includes(ctx.req.method)
        ? await ctx.req.json()
        : undefined;
      const result = await callback(data);
      return json(result);
    } catch (error: any) {
      const status = error instanceof Error ? 400 : 500;
      console.error(error);
      return json({
        error: error.message || "Internal Server Error",
        details: error.details,
      }, status);
    }
  }

  static handlers(
    handlersMap: Record<string, (ctx: FreshContext) => Promise<Response>>,
  ): (ctx: FreshContext) => Promise<Response> {
    return async (ctx: FreshContext) => {
      const method = ctx.req.method.toUpperCase();
      const handler = handlersMap[method];

      if (!handler) {
        throw new DatabaseError(`Method ${method} not allowed`, {
          allowedMethods: Object.keys(handlersMap),
        });
      }

      const response = await handler(ctx);

      return response;
    };
  }
}
