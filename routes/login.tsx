import { define } from "@/utils.ts";
import { authenticateUser } from "@/lib/users.ts";
import BrandHeader from "@/components/BrandHeader.tsx";

export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();

    if (email && password) {
      const { ok, id, error } = await authenticateUser(email, password);

      if (!ok || !id) {
        ctx.state.flash("error", error || "Invalid email or password");
        return ctx.redirect("/login");
      }

      // 4. Log user in (Rotation is handled automatically)
      await ctx.state.login(id);

      return ctx.redirect("/");
    }

    ctx.state.flash("error", "Invalid email or password");

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
                  <span class="label-text">Email</span>
                </label>
                <input
                  type="email"
                  name="email"
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
                  required
                />
              </div>
              <div class="flex flex-row-reverse justify-between items-center mt-2">
                <button
                  type="submit"
                  class="btn btn-sm bg-brand hover:bg-brand/80 text-black border-none shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Sign In
                </button>
                <a
                  href="/register"
                  class="link text-brand text-sm hover:text-brand/80 transition-colors"
                >
                  Register
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});
