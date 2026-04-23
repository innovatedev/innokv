import { defineAuth } from "@/utils.ts";
import { listTokens, revokeToken } from "@/lib/tokens.ts";
import TokenList from "@/islands/settings/TokenList.tsx";
import { Button } from "@/components/Button.tsx";

export const handler = defineAuth.handlers({
  async DELETE(ctx) {
    const userId = ctx.state.userId;
    // Helper handles 401, middleware handles redirect, but we assume secure state

    const url = new URL(ctx.req.url);
    const id = url.searchParams.get("id");

    if (id) {
      await revokeToken(userId, id);
    }
    return new Response(null, { status: 200 });
  },
});

export default defineAuth.page(async function TokenIndex({ state }) {
  const userId = state.userId;
  const tokens = await listTokens(userId);

  return (
    <div class="min-h-screen bg-base-200 py-8">
      <div class="container mx-auto max-w-4xl px-4">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <Button href="/" color="ghost" size="sm">
              ← Dashboard
            </Button>
            <h1 class="text-2xl font-bold">API Tokens</h1>
          </div>
          <Button href="/user/tokens/create" color="brand" size="xs">
            + Create New Token
          </Button>
        </div>

        <TokenList initialTokens={tokens} />
      </div>
    </div>
  );
});
