"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Mail } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { hubEnabled } from "@/lib/supabase/config";

export function LoginForm() {
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in didn't complete. Try again." : null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function github() {
    setError(null);
    const { error } = await browserSupabase()!.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  }

  async function emailLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const { error } = await browserSupabase()!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (!hubEnabled) {
    return <p className="text-sm text-muted">Accounts aren&apos;t set up on this server yet.</p>;
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={github}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90"
      >
        <GitHubMark /> Continue with GitHub
      </button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      {state === "sent" ? (
        <p className="rounded-xl bg-success/10 p-3 text-sm text-success">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form onSubmit={emailLink} className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:border-accent disabled:opacity-50"
          >
            {state === "sending" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />}
            Email me a sign-in link
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// lucide-react no longer ships brand icons
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
