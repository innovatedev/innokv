import { defineAuth } from "@/utils.ts";
import { createToken } from "@/lib/tokens.ts";
import { ApiToken } from "@/kv/models.ts";
import { Button } from "@/components/Button.tsx";

export const handler = defineAuth.handlers({
  async POST(ctx) {
    const userId = ctx.state.userId;
    const form = await ctx.req.formData();
    const name = form.get("name")?.toString();
    const type = form.get("type")?.toString() as ApiToken["type"];
    const expirationStr = form.get("expiration")?.toString(); // "never", "30d", "90d", "1y"

    if (!name || !type) {
      ctx.state.flash("error", "Name and Type are required");
      return ctx.redirect("/user/tokens/create");
    }

    // Parse Expiration
    let expiresAt: Date | undefined;
    if (expirationStr && expirationStr !== "never") {
      const now = new Date();
      if (expirationStr === "30d") now.setDate(now.getDate() + 30);
      if (expirationStr === "90d") now.setDate(now.getDate() + 90);
      if (expirationStr === "1y") now.setFullYear(now.getFullYear() + 1);
      expiresAt = now;
    }

    // Parse Rules
    const rules: ApiToken["rules"] = [];
    if (type === "scoped") {
      let i = 0;
      while (form.has(`rule_${i}_scope`)) {
        const scope = form.get(`rule_${i}_scope`)?.toString();
        const effect = form.get(`rule_${i}_effect`)?.toString() as
          | "allow"
          | "deny";
        const read = form.get(`rule_${i}_read`) === "on";
        const write = form.get(`rule_${i}_write`) === "on";
        const manage = form.get(`rule_${i}_manage`) === "on";

        if (scope && effect) {
          rules.push({
            effect,
            scope,
            permissions: { read, write, manage },
          });
        }
        i++;
      }
    }

    const { ok, secret, error } = await createToken(userId, {
      name,
      type,
      rules,
      expiresAt,
    });

    if (ok && secret) {
      ctx.state.flash("token_secret", secret);
      ctx.state.flash("token_name", name);
      return ctx.redirect("/user/tokens/create");
    } else {
      ctx.state.flash("error", error || "Failed to create token");
      return ctx.redirect("/user/tokens/create");
    }
  },
});

export default defineAuth.page(function CreateTokenPage(
  { state },
) {
  const secret = state.flash("token_secret");
  // const name = state.flash("token_name"); // Use if needed
  const error = state.flash("error");

  // If token created effectively, show the secret
  if (secret) {
    return (
      <div class="min-h-screen bg-base-200 py-8 flex items-center justify-center">
        <div class="card w-full max-w-lg bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title text-success">Token Created!</h2>
            <p>
              Please copy your access token now. You will not be able to see it
              again!
            </p>
            <div class="mockup-code bg-neutral text-neutral-content my-4">
              <pre><code>{secret}</code></pre>
            </div>
            <div class="card-actions justify-end">
              <a href="/user/tokens" class="btn btn-brand">
                Return to Tokens
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="hero min-h-screen bg-base-200">
      <div class="hero-content flex-col w-full max-w-lg">
        <div class="flex items-center justify-between w-full mb-4">
          <div class="flex items-center gap-4">
            <a href="/user/tokens" class="btn btn-ghost btn-sm">
              ← Back to List
            </a>
            <h1 class="text-2xl font-bold">Create API Token</h1>
          </div>
        </div>

        {error && (
          <div role="alert" class="alert alert-error mb-4 w-full">
            <span>{error}</span>
          </div>
        )}

        <div class="card shrink-0 w-full max-w-lg shadow-2xl bg-base-100">
          <div class="card-body">
            <form method="POST" id="create-token-form">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Token Name</span>
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="My Script Token"
                  class="input input-bordered input-sm"
                  required
                />
              </div>

              <div class="form-control mt-4">
                <label class="label">
                  <span class="label-text">Expiration</span>
                </label>
                <select
                  name="expiration"
                  class="select select-bordered select-sm"
                >
                  <option value="never">Never</option>
                  <option value="30d">30 Days</option>
                  <option value="90d">90 Days</option>
                  <option value="1y">1 Year</option>
                </select>
              </div>

              <div class="form-control mt-4">
                <label class="label">
                  <span class="label-text">Token Type</span>
                </label>
                <div class="flex gap-4">
                  <label class="label cursor-pointer gap-2 border p-3 rounded-lg flex-1 hover:border-brand transition-colors">
                    <input
                      type="radio"
                      name="type"
                      value="personal"
                      class="radio radio-primary radio-sm"
                      checked
                      id="type-personal"
                    />
                    <div>
                      <span class="label-text font-bold block">
                        Personal Access
                      </span>
                      <span class="label-text text-xs opacity-70">
                        Inherits your full permissions
                      </span>
                    </div>
                  </label>
                  <label class="label cursor-pointer gap-2 border p-3 rounded-lg flex-1 hover:border-brand transition-colors">
                    <input
                      type="radio"
                      name="type"
                      value="scoped"
                      class="radio radio-primary radio-sm"
                      id="type-scoped"
                    />
                    <div>
                      <span class="label-text font-bold block">
                        Scoped Access
                      </span>
                      <span class="label-text text-xs opacity-70">
                        Limit access to specific DBs
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Rules Section (Hidden by default) */}
              <div id="rules-section" class="mt-6 hidden">
                <h3 class="font-bold text-sm mb-2 uppercase opacity-60">
                  Access Rules
                </h3>
                <div
                  id="rules-container"
                  class="flex flex-col gap-4 bg-base-200 p-4 rounded-lg"
                >
                  {/* Initial Rule */}
                  <div class="rule-item card bg-base-100 p-3 shadow-sm border border-base-200">
                    <div class="flex gap-2 mb-2">
                      <select
                        name="rule_0_effect"
                        class="select select-bordered select-sm w-24"
                      >
                        <option value="allow">Allow</option>
                        <option value="deny">Deny</option>
                      </select>
                      <input
                        type="text"
                        name="rule_0_scope"
                        placeholder="Scope (e.g. *, test/*)"
                        class="input input-bordered input-sm flex-1"
                        value="*"
                        required
                      />
                    </div>
                    <div class="flex gap-4 px-2 justify-between">
                      <label class="cursor-pointer label gap-2 p-0">
                        <input
                          type="checkbox"
                          name="rule_0_read"
                          class="checkbox checkbox-xs"
                          checked
                        />
                        <span class="label-text text-xs">Read</span>
                      </label>
                      <label class="cursor-pointer label gap-2 p-0">
                        <input
                          type="checkbox"
                          name="rule_0_write"
                          class="checkbox checkbox-xs"
                          checked
                        />
                        <span class="label-text text-xs">Write</span>
                      </label>
                      <label class="cursor-pointer label gap-2 p-0">
                        <input
                          type="checkbox"
                          name="rule_0_manage"
                          class="checkbox checkbox-xs"
                        />
                        <span class="label-text text-xs">Manage</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div class="mt-2 text-xs opacity-70">
                  * Currently supports one rule via UI.
                </div>
              </div>

              <div class="form-control mt-6">
                <div class="flex justify-end">
                  <Button type="submit">
                    Generate Token
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <script
        // deno-lint-ignore react-no-danger
        dangerouslySetInnerHTML={{
          __html: `
        const personal = document.getElementById('type-personal');
        const scoped = document.getElementById('type-scoped');
        const rules = document.getElementById('rules-section');
        
        function updateRules() {
          if (scoped.checked) {
            rules.style.display = 'block';
          } else {
            rules.style.display = 'none';
          }
        }
        
        if (personal && scoped) {
          personal.addEventListener('change', updateRules);
          scoped.addEventListener('change', updateRules);
          // Set initial state based on checked radio button
          updateRules();
        }
      `,
        }}
      />
    </div>
  );
});
