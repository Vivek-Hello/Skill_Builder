import "server-only";
import { analyzeDescription, generateSkill, pickBestMatch, repairSkill, searchWebForSkills } from "./gemini";
import { candidatesFromUrl, fetchSkillFolder, hasGithubToken, isPermissive, searchGithub } from "./github";
import { parseSkillMd, validateSkill } from "./validate";
import type { BuildEvent, BuildResult, Candidate, SkillFile } from "./types";

// Minimum match score before we hand over an existing skill instead of generating
const CLONE_THRESHOLD = 85;

export async function buildSkill(description: string, emit: (e: BuildEvent) => void): Promise<BuildResult> {
  emit({ type: "step", step: "analyze", status: "running" });
  const analysis = await analyzeDescription(description);
  emit({ type: "step", step: "analyze", status: "done", detail: `${analysis.name}: ${analysis.summary}` });

  emit({ type: "step", step: "search", status: "running" });
  const [ghCandidates, webUrls] = await Promise.all([
    searchGithub(analysis.keywords),
    searchWebForSkills(analysis).catch(() => [] as string[]),
  ]);
  const webCandidates = (await Promise.all(webUrls.map(candidatesFromUrl))).flat();
  const candidates = dedupe([...ghCandidates, ...webCandidates]);
  emit({
    type: "step", step: "search", status: "done",
    detail: `${candidates.length} existing skill(s) found` + (hasGithubToken ? "" : " (web only, no GITHUB_TOKEN)"),
  });

  let match: BuildResult["match"];
  const related: BuildResult["related"] = [];

  if (candidates.length) {
    emit({ type: "step", step: "match", status: "running" });
    const verdict = await pickBestMatch(description, candidates);
    const best = candidates[verdict.index];
    if (best) {
      if (verdict.score >= CLONE_THRESHOLD && isPermissive(best.license)) {
        match = { ...best, score: verdict.score, reason: verdict.reason };
      } else {
        const note = verdict.score < CLONE_THRESHOLD
          ? `Partial match (${verdict.score}/100): ${verdict.reason}`
          : `Good match, but its license (${best.license ?? "none"}) doesn't allow copying`;
        related.push({ ...best, note });
      }
    }
    emit({
      type: "step", step: "match", status: "done",
      detail: best ? `Best: ${best.name} (${verdict.score}/100)` : "Nothing close enough",
    });
  } else {
    emit({ type: "step", step: "match", status: "skipped" });
  }

  let files: SkillFile[] = [];
  let origin: BuildResult["origin"] = "generated";

  if (match) {
    emit({ type: "step", step: "clone", status: "running", detail: match.repo });
    try {
      files = await fetchSkillFolder(match);
      origin = "cloned";
      emit({ type: "step", step: "clone", status: "done", detail: `${files.length} file(s) from ${match.repo}` });
      emit({ type: "step", step: "generate", status: "skipped" });
    } catch {
      related.push({ ...match, note: "Matched, but downloading it failed" });
      match = undefined;
      emit({ type: "step", step: "clone", status: "done", detail: "Download failed, generating instead" });
    }
  } else {
    emit({ type: "step", step: "clone", status: "skipped" });
  }

  if (origin === "generated") {
    emit({ type: "step", step: "generate", status: "running" });
    files = sanitize(await generateSkill(description, analysis, candidates.slice(0, 5)));
    emit({ type: "step", step: "generate", status: "done", detail: `${files.length} file(s)` });
  }

  emit({ type: "step", step: "validate", status: "running" });
  let issues = validateSkill(files);
  // Generated skills get one automatic repair pass; cloned skills are handed over as-is
  if (origin === "generated" && issues.some((i) => i.level === "error")) {
    files = sanitize(await repairSkill(files, issues));
    issues = validateSkill(files);
  }
  const errors = issues.filter((i) => i.level === "error").length;
  emit({
    type: "step", step: "validate", status: "done",
    detail: errors ? `${errors} error(s)` : `Passed${issues.length ? ` with ${issues.length} warning(s)` : ""}`,
  });

  const name = parseSkillMd(files.find((f) => f.path === "SKILL.md")?.content ?? "").meta?.name;
  return {
    origin,
    skillName: typeof name === "string" && name ? name : analysis.name,
    files,
    issues,
    match,
    related,
  };
}

function dedupe(list: Candidate[]) {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = `${c.repo}/${c.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Normalise model-produced paths and drop anything that could escape the skill folder
function sanitize(files: SkillFile[]): SkillFile[] {
  const out = new Map<string, SkillFile>();
  for (const f of files) {
    const path = f.path.replace(/\\/g, "/").replace(/^\.?\/+/, "");
    if (!path || path.split("/").includes("..")) continue;
    out.set(path, { path, content: f.content });
  }
  return [...out.values()];
}
