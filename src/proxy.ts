import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hubEnabled, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

// Refresh the Supabase session cookie before pages and routes read it
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  // Builder, test and playground APIs don't use accounts; skip the auth round trip
  if (!hubEnabled || (pathname.startsWith("/api/") && !pathname.startsWith("/api/hub/"))) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });
  // Validates the token with Supabase and rotates it when it's about to expire
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip static assets and images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
