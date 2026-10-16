// The skills hub is optional: without these two variables the builder still
// works and hub pages show a "not configured" notice.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hubEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Usernames that would collide with app routes; keep in sync with the migration
export const RESERVED_USERNAMES = new Set([
  "about", "admin", "api", "auth", "docs", "explore", "help", "login",
  "logout", "new", "settings", "signup", "skills", "u", "www",
]);
