import { define } from "../utils.ts";
import { hash } from "@felix/argon2";
import BrandHeader from "../components/BrandHeader.tsx";

export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const username = form.get("username")?.toString();
    const password = form.get("password")?.toString();

    if (!username || !password) {
      ctx.state.flash("error", "Missing username or password");
      return ctx.redirect("/register");
    }

    if (password.length < 8) {
      ctx.state.flash("error", "Password too short");
      return ctx.redirect("/register");
    }

    const kv = await Deno.openKv();
    const existing = await kv.get(["users", username]);
    if (existing.value) {
      ctx.state.flash("error", "User already exists");
      return ctx.redirect("/register");
    }

    // 1. Hash the password
    const passwordHash = await hash(password);

    // 2. Save user to DB (Example using Deno KV)
    const user = { username, passwordHash };
    await kv.set(["users", username], user);

    // 3. Log them in
    await ctx.state.login(username, { username });

    return ctx.redirect("/");
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
                  class="input input-bordered input-sm"
                  minLength={8}
                  required
                />
              </div>
              <div class="form-control mt-2 flex-row justify-end">
                <button type="submit" class="btn btn-primary btn-sm">
                  Register
                </button>
              </div>
            </form>

            <p class="mt-4 text-center text-sm">
              Already have an account?{" "}
              <a href="/login" class="link link-primary">
                Login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
