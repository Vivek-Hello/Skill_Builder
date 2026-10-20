import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { loadHub } from "@/features/hub/hub-unavailable";
import { GridSkeleton, HubDisabled, SkillGrid } from "@/features/hub/skill-card";
import { hubEnabled } from "@/lib/supabase/config";
import { exploreSkills, PAGE_SIZE, type ExploreSort } from "@/server/hub";

export const metadata: Metadata = { title: "Explore skills" };

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  if (!hubEnabled) return <HubDisabled />;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Explore skills</h1>
      <p className="mt-1 text-sm text-muted">Agent Skills published by the community. Star them, fork them, make them yours.</p>
      {/* Search terms come from the URL at request time */}
      <Suspense fallback={<GridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/explore">["searchParams"] }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const sort: ExploreSort = params.sort === "new" ? "new" : "stars";
  const page = Math.max(1, Number(params.page) || 1);
  const loaded = await loadHub(() => exploreSkills({ q, sort, page }));
  if ("unavailable" in loaded) return loaded.unavailable;
  const { skills, total } = loaded.data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (next: Record<string, string | number>) => {
    const sp = new URLSearchParams({ ...(q && { q }), sort, page: String(page), ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])) });
    return `/explore?${sp}`;
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action="/explore" className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 focus-within:border-accent sm:max-w-md">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">Search skills</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search skills…"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
          />
          <input type="hidden" name="sort" value={sort} />
        </form>
        <div className="flex rounded-xl border border-line p-0.5 text-sm">
          {(["stars", "new"] as const).map((s) => (
            <Link
              key={s}
              href={href({ sort: s, page: 1 })}
              className={`rounded-lg px-3 py-1.5 ${sort === s ? "bg-panel-2 font-medium" : "text-muted hover:text-foreground"}`}
            >
              {s === "stars" ? "Most starred" : "Newest"}
            </Link>
          ))}
        </div>
        <span className="text-sm text-muted">{total} skill{total === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-6">
        {skills.length ? (
          <SkillGrid skills={skills} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
            {q ? `No skills match "${q}".` : "No skills published yet. Build one and publish it to be the first."}
          </p>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={href({ page: page - 1 })} className="rounded-lg border border-line px-3 py-1.5 hover:border-accent">Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={href({ page: page + 1 })} className="rounded-lg border border-line px-3 py-1.5 hover:border-accent">Next</Link>}
        </nav>
      )}
    </>
  );
}
