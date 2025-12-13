import { define } from "@/utils.ts";
import { hash } from "@felix/argon2";
import BrandHeader from "../components/BrandHeader.tsx";
import { db } from "@/lib/db.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();
    const confirmPassword = form.get("confirmPassword")?.toString();

    if (!email || !password || !confirmPassword) {
      ctx.state.flash("error", "Missing fields");
      return ctx.redirect("/register");
    }

    if (password !== confirmPassword) {
      ctx.state.flash("error", "Passwords do not match");
      return ctx.redirect("/register");
    }

    if (password.length < 8) {
      ctx.state.flash("error", "Password too short");
      return ctx.redirect("/register");
    }

    const existing = await db.users.findByPrimaryIndex("email", email);
    if (existing) {
      ctx.state.flash("error", "User already exists");
      return ctx.redirect("/register");
    }

    // 1. Hash the password
    const passwordHash = await hash(password);

    // 2. Save user to DB
    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
      permissions: [] as string[],
    };

    const commit = await db.users.add(user);
    if (!commit.ok) {
      ctx.state.flash("error", "Failed to create user");
      return ctx.redirect("/register");
    }

    // 3. Log them in
    await ctx.state.login(user.id);

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
                  minLength={8}
                  required
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Confirm Password</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  class="input input-bordered input-sm"
                  minLength={8}
                  required
                />
              </div>
              <div class="flex flex-row-reverse justify-between items-center mt-2">
                <button
                  type="submit"
                  class="btn btn-sm bg-brand hover:bg-brand/80 text-black border-none shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Create Account
                </button>
                <a
                  href="/login"
                  class="link text-brand text-sm hover:text-brand/80 transition-colors"
                >
                  Login
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});
