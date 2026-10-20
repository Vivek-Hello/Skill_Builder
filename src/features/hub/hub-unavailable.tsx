import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { HubError } from "@/server/hub";

// Run a hub page's data loading; turn hub database failures into a friendly message.
// Other errors (including notFound()) are rethrown so Next handles them.
export async function loadHub<T>(load: () => Promise<T>): Promise<{ data: T } | { unavailable: React.ReactNode }> {
  try {
    return { data: await load() };
  } catch (err) {
    if (err instanceof HubError) {
      console.error("hub unavailable:", err.message);
      return { unavailable: <HubUnavailable setupMissing={err.setupMissing} /> };
    }
    throw err;
  }
}

export function HubUnavailable({ setupMissing }: { setupMissing: boolean }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <DatabaseZap className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">
        {setupMissing ? "The skills hub database isn't set up yet" : "The skills hub is unavailable right now"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {setupMissing ? (
          <>
            Run <code className="font-mono">supabase/migrations/0001_skills_hub.sql</code> in the Supabase SQL Editor.
            See docs/hub-setup.md, step 2.
          </>
        ) : (
          "We couldn't reach the database. Try again in a moment."
        )}
      </p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
        Build a skill meanwhile
      </Link>
    </div>
  );
}
