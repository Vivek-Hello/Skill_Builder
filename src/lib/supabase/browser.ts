"use client";

import { createBrowserClient } from "@supabase/ssr";
import { hubEnabled, SUPABASE_KEY, SUPABASE_URL } from "./config";

// One client per tab; it keeps the session in cookies the server can read too
export function browserSupabase() {
  if (!hubEnabled) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
