"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

// Fallback for unexpected errors on hub pages (used by their error.tsx files)
export function HubErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">Something went wrong loading this page</h1>
      <p className="mt-2 text-sm text-muted">It&apos;s probably temporary. Try again, or come back in a minute.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          onClick={retry}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          <RefreshCw className="size-4" aria-hidden /> Try again
        </button>
        <Link href="/" className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-accent">
          Home
        </Link>
      </div>
    </div>
  );
}
