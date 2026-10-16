"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { hubEnabled } from "@/lib/supabase/config";
import { Avatar } from "./avatar";
import { useHubUser } from "./use-hub-user";

export function UserMenu() {
  const profile = useHubUser();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  if (!hubEnabled || profile === undefined) return null;

  if (!profile) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-foreground"
      >
        Sign in
      </Link>
    );
  }

  async function signOut() {
    await browserSupabase()?.auth.signOut();
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-line"
      >
        <Avatar url={profile.avatar_url} name={profile.username} size={28} />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-panel py-1 text-sm shadow-lg"
        >
          <p className="truncate border-b border-line px-3 py-2 text-xs text-muted">
            Signed in as <span className="font-medium text-foreground">{profile.username}</span>
          </p>
          <Link
            role="menuitem"
            href={`/${profile.username}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-panel-2"
          >
            <User className="size-4" aria-hidden /> Your skills
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-panel-2"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
