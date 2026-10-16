import "server-only";
import { hubEnabled } from "@/lib/supabase/config";
import { currentProfile } from "./hub";
import { userSupabase } from "./supabase";

// For hub route handlers: the signed-in user's client and profile, or an error response
export async function requireUser() {
  if (!hubEnabled) {
    return { error: Response.json({ error: "The skills hub isn't configured on this server." }, { status: 503 }) };
  }
  const supabase = await userSupabase();
  const profile = await currentProfile(supabase);
  if (!profile) return { error: Response.json({ error: "Sign in first." }, { status: 401 }) };
  return { supabase, profile };
}
