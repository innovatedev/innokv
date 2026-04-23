/**
 * Checks if a user has a specific permission.
 *
 * Logic:
 * 1. Check for DENY rules first (prefixed with "-").
 * 2. If user has "*", they have all permissions (unless denied).
 * 3. Specific ALLOW rules.
 *
 * @param userPermissions List of permissions granted to the user.
 * @param requiredPermission The specific permission required (e.g. "database:read:test").
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string,
): boolean {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }

  // 1. Check for DENY rules first
  // A deny rule explicitly blocks a permission, regardless of wildcards.
  // We check for exact match "database:read:test" OR parent hierarchy "database:read"
  for (const p of userPermissions) {
    if (p.startsWith("-")) {
      const deniedPerm = p.substring(1); // Remove "-"

      // Exact match deny
      if (deniedPerm === requiredPermission) return false;

      // Hierarchy deny (e.g. -database:read blocks database:read:test)
      if (requiredPermission.startsWith(deniedPerm + ":")) return false;
    }
  }

  // 2. Admin / Wildcard check
  if (userPermissions.includes("*")) {
    return true;
  }

  // 3. Iterate through user permissions to find a match
  for (const p of userPermissions) {
    // Exact match
    if (p === requiredPermission) {
      return true;
    }

    // Hierarchy / Prefix match
    // e.g. p="database:manage" allows required="database:manage:test"
    if (requiredPermission.startsWith(p + ":")) {
      return true;
    }
  }

  return false;
}

export function rulesToPermissions(
  rules: {
    scope: string;
    permissions: { read: boolean; write: boolean; manage?: boolean };
    effect: "allow" | "deny";
  }[],
): string[] {
  const permissions: string[] = [];

  for (const rule of rules) {
    const prefix = rule.effect === "deny" ? "-" : "";
    const scope = rule.scope === "*" ? "" : `:${rule.scope}`;

    if (rule.permissions.manage) {
      if (rule.scope === "*") permissions.push(`${prefix}database:manage`);
      else permissions.push(`${prefix}database:manage${scope}`);
    }
    if (rule.permissions.write) {
      if (rule.scope === "*") permissions.push(`${prefix}database:write`);
      else permissions.push(`${prefix}database:write${scope}`);
    }
    if (rule.permissions.read) {
      if (rule.scope === "*") permissions.push(`${prefix}database:read`);
      else permissions.push(`${prefix}database:read${scope}`);
    }
  }

  return permissions;
}
