"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/hub-types";
import { browserSupabase } from "@/lib/supabase/browser";

// The signed-in user's profile in client components. undefined while loading, null when signed out.
export function useHubUser() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) {
      queueMicrotask(() => setProfile(null));
      return;
    }
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setProfile(null);
      const { data: row } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, created_at")
        .eq("id", data.user.id)
        .maybeSingle();
      setProfile((row as Profile | null) ?? null);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  return profile;
}
