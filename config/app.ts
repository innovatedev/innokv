const settings = {
  db: {
    path: Deno.env.get("INNOVK_DB_PATH") ?? "innokv-data/db.kv",
  },
  admin: {
    emails: (Deno.env.get("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0),
  },
};

export default settings;
