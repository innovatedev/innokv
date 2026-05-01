import { useState } from "preact/hooks";
import { ApiToken } from "@/kv/models.ts";
import { Button } from "@/components/Button.tsx";

export default function TokenList({
  initialTokens,
}: {
  initialTokens: ApiToken[];
}) {
  const [tokens, setTokens] = useState<ApiToken[]>(initialTokens);
  const [loading, setLoading] = useState(false);

  const handleRevoke = async (tokenId: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this token? This action cannot be undone.",
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/user/tokens?id=${tokenId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTokens(tokens.filter((t) => t.id !== tokenId));
      } else {
        alert("Failed to revoke token");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isNew = (date: Date) => {
    return (Date.now() - new Date(date).getTime()) < 1000 * 60 * 60 * 24; // 24 hours
  };

  return (
    <div class="overflow-x-auto bg-base-100 rounded-box border border-base-200">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Created</th>
            <th>Last Used</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tokens.length === 0
            ? (
              <tr>
                <td colSpan={6} class="text-center text-base-content/50">
                  No tokens found.
                </td>
              </tr>
            )
            : tokens.map((token) => (
              <tr key={token.id}>
                <td class="font-bold">
                  {token.name}
                  {isNew(token.createdAt!) && (
                    <span class="badge badge-sm badge-success ml-2">
                      NEW
                    </span>
                  )}
                </td>
                <td>
                  <span
                    class={`badge badge-sm ${
                      token.type === "personal"
                        ? "badge-brand"
                        : "badge-secondary"
                    }`}
                  >
                    {token.type}
                  </span>
                </td>
                <td class="text-sm">
                  {new Date(token.createdAt!).toLocaleDateString()}
                </td>
                <td class="text-sm">
                  {token.lastUsedAt
                    ? new Date(token.lastUsedAt).toLocaleDateString()
                    : <span class="opacity-50">-</span>}
                </td>
                <td class="text-sm">
                  {token.expiresAt
                    ? new Date(token.expiresAt).toLocaleDateString()
                    : <span class="opacity-50">Never</span>}
                </td>
                <td>
                  <Button
                    size="xs"
                    color="error"
                    variant="outline"
                    onClick={() => handleRevoke(token.id)}
                    disabled={loading}
                  >
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
