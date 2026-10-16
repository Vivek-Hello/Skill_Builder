import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GitFork, History, Info, Scale, Sparkles, WandSparkles } from "lucide-react";
import { Avatar, formatDate } from "@/features/hub/avatar";
import { InstallSteps } from "@/features/hub/install-steps";
import { SkillActions } from "@/features/hub/skill-actions";
import { HubDisabled } from "@/features/hub/skill-card";
import { Playground } from "@/features/playground/playground";
import { FileBrowser } from "@/features/workspace/file-browser";
import type { HubSkill } from "@/lib/hub-types";
import { hubEnabled } from "@/lib/supabase/config";
import { getSkill, getVersion, listVersions } from "@/server/hub";

type Props = PageProps<"/[username]/[skill]">;

export default function SkillPage({ params, searchParams }: Props) {
  if (!hubEnabled) return <HubDisabled />;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Suspense fallback={<PageSkeleton />}>
        <SkillView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SkillView({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ username, skill: slug }, query] = await Promise.all([params, searchParams]);
  const skill = await getSkill(decodeURIComponent(username), decodeURIComponent(slug));
  if (!skill) notFound();

  const requested = Number(query.v);
  const versionNumber = Number.isInteger(requested) && requested >= 1 && requested <= skill.latest_version ? requested : skill.latest_version;
  const [version, versions] = await Promise.all([getVersion(skill.id, versionNumber), listVersions(skill.id)]);
  if (!version) notFound();
  const isLatest = version.version === skill.latest_version;
  const base = `/${skill.owner.username}/${skill.slug}`;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl sm:text-2xl">
            <Link href={`/${skill.owner.username}`} className="flex items-center gap-2 text-muted hover:text-foreground">
              <Avatar url={skill.owner.avatar_url} name={skill.owner.username} size={28} />
              {skill.owner.username}
            </Link>
            <span className="text-muted">/</span>
            <span className="font-mono font-semibold wrap-anywhere">{skill.slug}</span>
          </h1>
          <Lineage skill={skill} />
          <p className="mt-2 max-w-3xl text-sm text-muted">{skill.description}</p>
        </div>
        <SkillActions
          skillId={skill.id}
          slug={skill.slug}
          owner={skill.owner.username}
          stars={skill.stars_count}
          forks={skill.forks_count}
          files={version.files}
        />
      </div>

      {!isLatest && (
        <p className="mt-4 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm">
          You&apos;re viewing <strong>v{version.version}</strong>.{" "}
          <Link href={base} className="text-accent underline">Go to the latest (v{skill.latest_version})</Link>
        </p>
      )}

      {version.changes && version.changes.length > 0 && (
        <section className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft/60 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <WandSparkles className="size-4 text-accent" aria-hidden /> What changed in v{version.version}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {version.changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <FileBrowser files={version.files} />

        <aside className="min-w-0 space-y-4">
          <Card title="About" icon={Info}>
            <dl className="space-y-2 text-sm">
              <Row label="Version">v{version.version}{isLatest && " (latest)"} · {formatDate(version.created_at)}</Row>
              <Row label="License">
                <span className="inline-flex items-center gap-1">
                  <Scale className="size-3.5 text-muted" aria-hidden /> {skill.license ?? "Not specified"}
                </span>
              </Row>
              <Row label="Published">{formatDate(skill.created_at)}</Row>
              <Row label="Files">{version.files.length}</Row>
            </dl>
          </Card>

          <Card title="Install" icon={Sparkles}>
            <InstallSteps slug={skill.slug} />
          </Card>

          <div className="overflow-hidden rounded-2xl border border-line bg-panel">
            <Playground skillName={skill.slug} files={version.files} />
          </div>

          <Card title={`Versions (${versions.length})`} icon={History}>
            <ol className="space-y-1">
              {versions.map((v) => (
                <li key={v.version}>
                  <Link
                    href={v.version === skill.latest_version ? base : `${base}?v=${v.version}`}
                    className={`flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel-2 ${v.version === version.version ? "bg-panel-2" : ""}`}
                  >
                    <span className="font-mono text-xs font-semibold">v{v.version}</span>
                    <span className="min-w-0 flex-1 truncate">{v.message || "No message"}</span>
                    <span className="shrink-0 text-xs text-muted">{formatDate(v.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </>
  );
}

// Where this skill came from: a fork on the hub, or a skill on GitHub
function Lineage({ skill }: { skill: HubSkill }) {
  if (skill.parent) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
        <GitFork className="size-3.5" aria-hidden /> forked from{" "}
        <Link href={`/${skill.parent.owner.username}/${skill.parent.slug}`} className="text-accent underline">
          {skill.parent.owner.username}/{skill.parent.slug}
        </Link>
      </p>
    );
  }
  if (skill.source) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
        {skill.origin === "adapted" ? <WandSparkles className="size-3.5" aria-hidden /> : <GitFork className="size-3.5" aria-hidden />}
        {skill.origin === "adapted" ? "adapted from" : "from"}{" "}
        <a href={skill.source.url} target="_blank" rel="noreferrer" className="text-accent underline">
          {skill.source.repo}
        </a>{" "}
        on GitHub
      </p>
    );
  }
  return null;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Info; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-8 w-72 animate-pulse rounded-lg bg-panel" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-panel" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-panel" />
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-panel" />
      </div>
    </div>
  );
}
