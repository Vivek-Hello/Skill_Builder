import "server-only";
import { Octokit } from "@octokit/rest";
import { parseSkillMd } from "./validate";
import type { Candidate, SkillFile } from "./types";

// Code search needs a token; everything else works anonymously at a low rate limit.
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
export const hasGithubToken = Boolean(process.env.GITHUB_TOKEN);

// Licenses that let us hand a copy of the skill to the user.
const PERMISSIVE = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unlicense", "CC0-1.0", "0BSD", "MPL-2.0",
]);
export const isPermissive = (license: string | null) => license !== null && PERMISSIVE.has(license);

const MAX_FILES = 60;
const MAX_FILE_BYTES = 300_000;

type RepoInfo = { stars: number; license: string | null; defaultBranch: string };
const repoCache = new Map<string, Promise<RepoInfo>>();

function repoInfo(repo: string): Promise<RepoInfo> {
  if (!repoCache.has(repo)) {
    const [owner, name] = repo.split("/");
    repoCache.set(
      repo,
      octokit.repos.get({ owner, repo: name }).then(({ data }) => ({
        stars: data.stargazers_count,
        license: data.license?.spdx_id && data.license.spdx_id !== "NOASSERTION" ? data.license.spdx_id : null,
        defaultBranch: data.default_branch,
      })),
    );
  }
  return repoCache.get(repo)!;
}

const decode = (b64: string) => Buffer.from(b64, "base64").toString("utf8");

async function loadCandidate(repo: string, path: string, source: Candidate["source"]): Promise<Candidate | null> {
  const [owner, name] = repo.split("/");
  try {
    const [info, { data }] = await Promise.all([
      repoInfo(repo),
      octokit.repos.getContent({ owner, repo: name, path }),
    ]);
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) return null;
    const { meta } = parseSkillMd(decode(data.content));
    if (!meta || typeof meta.name !== "string") return null;
    return {
      repo,
      path,
      url: `https://github.com/${repo}/blob/${info.defaultBranch}/${path}`,
      stars: info.stars,
      license: info.license,
      name: meta.name,
      description: typeof meta.description === "string" ? meta.description : "",
      source,
    };
  } catch {
    return null;
  }
}

export async function searchGithub(keywords: string[]): Promise<Candidate[]> {
  if (!hasGithubToken) return [];
  // One broad query plus one per keyword pair, so a single odd word doesn't sink the search
  const queries = [keywords.slice(0, 3).join(" "), ...keywords.slice(0, 3)].map(
    (q) => `${q} filename:SKILL.md`,
  );
  const hits = new Map<string, { repo: string; path: string }>();
  for (const q of queries) {
    try {
      const { data } = await octokit.search.code({ q, per_page: 10 });
      for (const item of data.items) {
        hits.set(`${item.repository.full_name}/${item.path}`, {
          repo: item.repository.full_name,
          path: item.path,
        });
      }
    } catch {
      // Rate-limited or a bad query; keep whatever we have
    }
  }
  const loaded = await Promise.all(
    [...hits.values()].slice(0, 20).map((h) => loadCandidate(h.repo, h.path, "github")),
  );
  return loaded.filter((c): c is Candidate => c !== null);
}

// Turn a github.com URL from web search into SKILL.md candidates
export async function candidatesFromUrl(url: string): Promise<Candidate[]> {
  const m = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/[^/]+\/(.*))?\/?$/);
  if (!m) return [];
  const repo = `${m[1]}/${m[2]}`;
  const sub = m[3]?.replace(/\/$/, "");

  if (sub) {
    const path = sub.endsWith("SKILL.md") ? sub : `${sub}/SKILL.md`;
    const c = await loadCandidate(repo, path, "web");
    return c ? [c] : [];
  }

  // Repo root: look for every SKILL.md in the repo
  try {
    const info = await repoInfo(repo);
    const { data } = await octokit.git.getTree({
      owner: m[1], repo: m[2], tree_sha: info.defaultBranch, recursive: "true",
    });
    const paths = data.tree
      .filter((t) => t.type === "blob" && t.path?.split("/").pop() === "SKILL.md")
      .map((t) => t.path!)
      .slice(0, 8);
    const loaded = await Promise.all(paths.map((p) => loadCandidate(repo, p, "web")));
    return loaded.filter((c): c is Candidate => c !== null);
  } catch {
    return [];
  }
}

// Download every text file in the folder that holds the candidate's SKILL.md
export async function fetchSkillFolder(c: Candidate): Promise<SkillFile[]> {
  const [owner, repo] = c.repo.split("/");
  const info = await repoInfo(c.repo);
  const dir = c.path.includes("/") ? c.path.slice(0, c.path.lastIndexOf("/") + 1) : "";
  const { data } = await octokit.git.getTree({
    owner, repo, tree_sha: info.defaultBranch, recursive: "true",
  });
  const blobs = data.tree
    .filter((t) => t.type === "blob" && t.path?.startsWith(dir) && (t.size ?? 0) <= MAX_FILE_BYTES)
    .slice(0, MAX_FILES);

  const files = await Promise.all(
    blobs.map(async (t) => {
      const { data: blob } = await octokit.git.getBlob({ owner, repo, file_sha: t.sha! });
      const content = decode(blob.content);
      if (content.includes("\0")) return null; // skip binary files
      return { path: t.path!.slice(dir.length), content };
    }),
  );
  return files.filter((f): f is SkillFile => f !== null);
}
