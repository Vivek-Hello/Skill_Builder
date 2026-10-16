import { NextResponse } from "next/server";
import { userSupabase } from "@/server/supabase";

// Supabase sends users here after GitHub or email sign-in
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  // Only redirect within this site
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await userSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
