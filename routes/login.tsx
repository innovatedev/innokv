import { define } from "../utils.ts";
import { verify } from "@felix/argon2";
import BrandHeader from "../components/BrandHeader.tsx";

export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const username = form.get("username")?.toString();
    const password = form.get("password")?.toString();

    if (username && password) {
      // 1. Fetch user from DB (Example using Deno KV)

      const kv = await Deno.openKv();
      const userRes = await kv.get(["users", username]);
      const user = userRes.value as
        | { username: string; passwordHash: string }
        | null;

      if (!user) {
        // User not found (generic error for security)
        ctx.state.flash("error", "Invalid username or password");
        return ctx.redirect("/login");
      }

      // 2. Verify password
      const isValid = await verify(user.passwordHash, password);
      if (!isValid) {
        ctx.state.flash("error", "Invalid username or password");
        return ctx.redirect("/login");
      }

      // 3. Log user in (Rotation is handled automatically)
      await ctx.state.login(username, { username });

      return ctx.redirect("/");
    }

    ctx.state.flash("error", "Invalid username or password");

    return ctx.redirect("/login");
  },
});

export default define.page<typeof handler>((ctx) => {
  const error = ctx.state.flash("error");

  return (
    <div class="hero min-h-screen bg-base-200">
      <div class="hero-content flex-col lg:flex-row-reverse">
        <div class="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
          <div class="card-body">
            <div class="flex justify-center mb-6">
              <BrandHeader />
            </div>
            {error && (
              <div role="alert" class="alert alert-error mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form method="POST" class="flex flex-col gap-6">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Username</span>
                </label>
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  class="input input-bordered input-sm"
                  required
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Password</span>
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  class="input input-bordered input-sm"
                  required
                />
              </div>
              <div class="form-control mt-2 flex-row justify-end">
                <button type="submit" class="btn btn-primary btn-sm">
                  Login
                </button>
              </div>
            </form>

            <p class="mt-4 text-center text-sm">
              Don't have an account?{" "}
              <a href="/register" class="link link-primary">
                Register
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
