import { Suspense } from "react";
import Link from "next/link";
import { Anvil, Compass, Library, Plus } from "lucide-react";
import { UserMenu } from "@/features/hub/user-menu";
import { BRAND } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white">
            <Anvil className="size-4" aria-hidden />
          </span>
          {BRAND.name}
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href="/explore"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-foreground"
          >
            <Compass className="size-4" aria-hidden />
            <span className="hidden sm:inline">Explore</span>
          </Link>
          <Link
            href="/skills"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-foreground"
          >
            <Library className="size-4" aria-hidden />
            <span className="hidden sm:inline">My skills</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 font-medium text-background hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            New skill
          </Link>
          {/* Reads the browser session and current path */}
          <Suspense>
            <UserMenu />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-xs text-muted">
        <span>{BRAND.name}</span>
        <span>Not affiliated with Anthropic. Claude is a trademark of Anthropic.</span>
        <a href={BRAND.repo} target="_blank" rel="noreferrer" className="ml-auto hover:text-foreground">
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}
