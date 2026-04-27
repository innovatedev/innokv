import { db } from "@/kv/db.ts";
import { json } from "./http.ts";
// deno-lint-ignore no-explicit-any
export interface SimpleContext<State = any> {
  req: Request;
  url: URL;
  params: Record<string, string>;
  state: State;
  next: () => Promise<Response>;
}

export class DatabaseError extends Error {
  // deno-lint-ignore no-explicit-any
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class BaseRepository {
  constructor(protected kvdex: typeof db) {
    // Automatically bind all methods to the instance
    const proto = Object.getPrototypeOf(this);
    for (const key of Object.getOwnPropertyNames(proto)) {
      // deno-lint-ignore no-explicit-any
      const value = (this as any)[key];
      if (typeof value === "function" && key !== "constructor") {
        // deno-lint-ignore no-explicit-any
        (this as any)[key] = value.bind(this);
      }
    }
  }

  // deno-lint-ignore no-explicit-any
  protected parseModel<T>(model: { parse: (data: any) => T }, data: any): T {
    return model.parse(data);
  }

  // deno-lint-ignore no-explicit-any
  async handleApiCall<T, S = any>(
    ctx: SimpleContext<S>,
    callback: (data: unknown) => Promise<T>,
  ): Promise<Response> {
    try {
      const data = ["POST", "DELETE", "PATCH", "PUT"].includes(ctx.req.method)
        ? await ctx.req.json()
        : undefined;
      const result = await callback(data);
      return json(result);
    } catch (error: unknown) {
      const status = error instanceof Error ? 400 : 500;
      console.error(error);
      const message = error instanceof Error
        ? error.message
        : "Internal Server Error";
      // deno-lint-ignore no-explicit-any
      const details = (error as any).details;

      return json({
        error: message,
        details,
      }, status);
    }
  }

  // deno-lint-ignore no-explicit-any
  static handlers<S = any>(
    handlersMap: Record<string, (ctx: SimpleContext<S>) => Promise<Response>>,
  ): (ctx: SimpleContext<S>) => Promise<Response> {
    return async (ctx: SimpleContext<S>) => {
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
