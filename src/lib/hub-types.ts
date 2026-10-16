import type { SkillFile } from "./types";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type HubOrigin = "generated" | "adapted" | "cloned" | "forked";

// A skill as listed on explore and profile pages
export type HubSkill = {
  id: string;
  slug: string;
  description: string;
  license: string | null;
  origin: HubOrigin;
  source: { repo: string; url: string; license: string | null } | null;
  latest_version: number;
  stars_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  owner: Pick<Profile, "username" | "display_name" | "avatar_url">;
  parent: { slug: string; owner: { username: string } } | null;
};

export type HubVersion = {
  version: number;
  message: string;
  changes: string[] | null;
  created_at: string;
};

export type HubVersionWithFiles = HubVersion & { files: SkillFile[] };

// What the publish endpoint returns, and what "My skills" remembers
export type PublishedRef = { skillId: string; username: string; slug: string; version: number };
