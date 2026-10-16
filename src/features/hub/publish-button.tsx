"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, Upload, X } from "lucide-react";
import type { PublishedRef } from "@/lib/hub-types";
import { postJson } from "@/lib/ndjson";
import { hubEnabled } from "@/lib/supabase/config";
import type { BuildResult } from "@/lib/types";
import { useHubUser } from "./use-hub-user";

const LICENSES = [
  ["MIT", "MIT: anyone can use, change and share it"],
  ["Apache-2.0", "Apache 2.0: like MIT, plus a patent grant"],
  ["CC-BY-4.0", "CC BY 4.0: reuse with credit"],
  ["CC0-1.0", "CC0: public domain"],
] as const;

type Props = {
  result: BuildResult;
  published?: PublishedRef;
  // Where to come back to after signing in
  returnTo: string;
  onPublished: (ref: PublishedRef) => void;
};

export function PublishButton({ result, published, returnTo, onPublished }: Props) {
  const user = useHubUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!hubEnabled) return null;

  function start() {
    if (user === null) router.push(`/login?next=${encodeURIComponent(returnTo)}`);
    else if (user) setOpen(true);
  }

  return (
    <>
      {published && (
        <Link
          href={`/${published.username}/${published.slug}`}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3.5 py-2 text-sm font-medium hover:border-accent"
        >
          <ExternalLink className="size-4" aria-hidden /> v{published.version} on hub
        </Link>
      )}
      <button
        type="button"
        onClick={start}
        disabled={user === undefined}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3.5 py-2 text-sm font-medium hover:border-accent disabled:opacity-40"
      >
        <Upload className="size-4" aria-hidden /> {published ? "Publish update" : "Publish"}
      </button>
      {open && (
        <PublishDialog
          result={result}
          isUpdate={Boolean(published)}
          onClose={() => setOpen(false)}
          onPublished={(ref) => {
            setOpen(false);
            onPublished(ref);
          }}
        />
      )}
    </>
  );
}

function PublishDialog({
  result,
  isUpdate,
  onClose,
  onPublished,
}: {
  result: BuildResult;
  isUpdate: boolean;
  onClose: () => void;
  onPublished: (ref: PublishedRef) => void;
}) {
  const [message, setMessage] = useState(isUpdate ? "" : "First version");
  const [license, setLicense] = useState<string>("MIT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Skills based on someone else's work keep their license
  const inherited = result.origin !== "generated" ? result.source?.license ?? null : null;

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ref = await postJson<PublishedRef>("/api/hub/publish", {
        files: result.files,
        message,
        license,
        origin: result.origin,
        source: result.source,
        changes: result.adaptation?.changes ?? null,
      });
      onPublished(ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        onSubmit={publish}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-xl"
      >
        <div className="flex items-start">
          <h2 id="publish-title" className="font-semibold">
            {isUpdate ? "Publish a new version" : "Publish to the hub"}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} className="ml-auto rounded-md p-1 text-muted hover:bg-panel-2">
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          <span className="font-mono text-foreground">{result.skillName}</span> will be public: anyone can view,
          download, star and fork it.
        </p>

        <label htmlFor="pub-message" className="mt-4 block text-sm font-medium">What&apos;s in this version?</label>
        <input
          id="pub-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          placeholder="Added MySQL support"
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
        />

        <p className="mt-4 text-sm font-medium">License</p>
        {result.origin !== "generated" ? (
          <p className="mt-1.5 rounded-xl bg-panel-2 px-3 py-2 text-sm text-muted">
            Keeps the original {inherited ?? "license"}, because it&apos;s based on {result.source?.repo}.
          </p>
        ) : (
          <select
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            aria-label="License"
            className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {LICENSES.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {busy ? "Publishing…" : isUpdate ? "Publish new version" : "Publish"}
        </button>
      </form>
    </div>
  );
}
