import "server-only";
import {
  adaptSkill,
  analyzeDescription,
  generateSkill,
  repairSkill,
  scoreMatches,
  searchWebForSkills,
} from "@/server/ai/gemini";
import { candidatesFromUrl, fetchSkillFolder, hasGithubToken, isPermissive, searchGithub } from "@/server/github";
import { parseSkillMd, stripWrapperFolder, validateSkill } from "@/lib/validate";
import type { BuildEvent, BuildResult, Candidate, ScoredCandidate, SkillFile } from "@/lib/types";

// Match score needed to hand over an existing skill as-is, or to adapt it instead of
// writing a new one. Below ADAPT_THRESHOLD a fresh skill is usually better.
const CLONE_THRESHOLD = 85;
const ADAPT_THRESHOLD = 60;
// Too much source to send to the model in one go; build fresh instead
const MAX_ADAPT_CHARS = 150_000;
const MIN_LISTED_SCORE = 40;

type BuildOptions = { forceGenerate?: boolean };

export async function buildSkill(
  description: string,
  emit: (e: BuildEvent) => void,
  { forceGenerate = false }: BuildOptions = {},
): Promise<BuildResult> {
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

  let matches: ScoredCandidate[] = [];
  if (candidates.length) {
    emit({ type: "step", step: "match", status: "running" });
    const scores = await scoreMatches(description, candidates);
    matches = scores
      .map((s) => ({
        ...candidates[s.index],
        score: s.score,
        reason: s.reason,
        cloneable: isPermissive(candidates[s.index].license),
      }))
      .filter((m) => m.score >= MIN_LISTED_SCORE)
      .sort((a, b) => b.score - a.score);
    emit({
      type: "step", step: "match", status: "done",
      detail: matches[0] ? `Best: ${matches[0].name} (${matches[0].score}/100)` : "Nothing close enough",
    });
  } else {
    emit({ type: "step", step: "match", status: "skipped" });
  }

  const best = forceGenerate ? undefined : matches.find((m) => m.cloneable);

  if (best && best.score >= CLONE_THRESHOLD) {
    emit({ type: "step", step: "clone", status: "running", detail: best.repo });
    try {
      const result = await cloneSkill(best);
      emit({ type: "step", step: "clone", status: "done", detail: `${result.files.length} file(s) from ${best.repo}` });
      emit({ type: "step", step: "adapt", status: "skipped" });
      emit({ type: "step", step: "generate", status: "skipped" });
      emit({ type: "step", step: "validate", status: "done", detail: summarizeIssues(result) });
      return { ...result, matches, examples: analysis.triggers };
    } catch {
      emit({ type: "step", step: "clone", status: "done", detail: "Download failed, building instead" });
    }
  } else {
    emit({ type: "step", step: "clone", status: "skipped" });
  }

  if (best && best.score >= ADAPT_THRESHOLD && best.score < CLONE_THRESHOLD) {
    emit({ type: "step", step: "adapt", status: "running", detail: `${best.name} (${best.score}/100)` });
    try {
      const result = await adaptExisting(best, description, (detail) =>
        emit({ type: "step", step: "validate", status: "running", detail }),
      );
      const changes = result.adaptation?.changes.length ?? 0;
      emit({ type: "step", step: "adapt", status: "done", detail: `${changes} change(s) to ${best.repo}` });
      emit({ type: "step", step: "generate", status: "skipped" });
      emit({ type: "step", step: "validate", status: "done", detail: summarizeIssues(result) });
      return { ...result, matches, examples: analysis.triggers };
    } catch (err) {
      console.warn("adapt failed, generating instead", err);
      emit({ type: "step", step: "adapt", status: "done", detail: "Couldn't adapt it, building a new one instead" });
    }
  } else {
    emit({ type: "step", step: "adapt", status: "skipped" });
  }

  emit({ type: "step", step: "generate", status: "running" });
  let files = sanitize(await generateSkill(description, analysis, candidates.slice(0, 5)));
  emit({ type: "step", step: "generate", status: "done", detail: `${files.length} file(s)` });

  emit({ type: "step", step: "validate", status: "running" });
  let issues = validateSkill(files);
  // Generated skills get one automatic repair pass
  if (issues.some((i) => i.level === "error")) {
    files = sanitize(await repairSkill(files, issues));
    issues = validateSkill(files);
  }
  const result: BuildResult = {
    origin: "generated",
    skillName: skillNameOf(files) ?? analysis.name,
    files,
    issues,
    matches,
    examples: analysis.triggers,
  };
  emit({ type: "step", step: "validate", status: "done", detail: summarizeIssues(result) });
  return result;
}

// Take an existing skill and modify it to fit the request, keeping license files intact
export async function adaptExisting(
  candidate: Candidate,
  description: string,
  onValidate?: (detail: string) => void,
): Promise<BuildResult> {
  if (!isPermissive(candidate.license)) {
    throw new Error(`${candidate.repo} is licensed ${candidate.license ?? "without a license"}, so it can't be modified`);
  }
  const original = await fetchSkillFolder(candidate);
  if (original.reduce((n, f) => n + f.content.length, 0) > MAX_ADAPT_CHARS) {
    throw new Error("This skill is too large to adapt automatically");
  }

  const adapted = await adaptSkill(description, original, candidate);
  let files = keepLicenseFiles(sanitize(adapted.files), original);
  let issues = validateSkill(files);
  if (issues.some((i) => i.level === "error")) {
    onValidate?.("Fixing format problems");
    files = keepLicenseFiles(sanitize(await repairSkill(files, issues)), original);
    issues = validateSkill(files);
  }

  return {
    origin: "adapted",
    skillName: skillNameOf(files) ?? candidate.name,
    files,
    issues,
    source: { repo: candidate.repo, url: candidate.url, license: candidate.license, stars: candidate.stars },
    adaptation: { changes: adapted.changes },
    matches: [],
  };
}

// The model must not drop or edit the original license or notice files
function keepLicenseFiles(files: SkillFile[], original: SkillFile[]) {
  const isLegal = (p: string) => /^(license|licence|copying|notice)(\.|$)/i.test(p.split("/").pop() ?? "");
  const legal = original.filter((f) => isLegal(f.path));
  return [...files.filter((f) => !isLegal(f.path)), ...legal];
}

// Cloned skills are handed over as-is; validation only reports problems
export async function cloneSkill(candidate: Candidate): Promise<BuildResult> {
  if (!isPermissive(candidate.license)) {
    throw new Error(`${candidate.repo} is licensed ${candidate.license ?? "without a license"}, so it can't be copied`);
  }
  const files = await fetchSkillFolder(candidate);
  return {
    origin: "cloned",
    skillName: skillNameOf(files) ?? candidate.name,
    files,
    issues: validateSkill(files),
    source: { repo: candidate.repo, url: candidate.url, license: candidate.license, stars: candidate.stars },
    matches: [],
  };
}

function skillNameOf(files: SkillFile[]) {
  const name = parseSkillMd(files.find((f) => f.path === "SKILL.md")?.content ?? "").meta?.name;
  return typeof name === "string" && name ? name : null;
}

function summarizeIssues({ issues }: BuildResult) {
  const errors = issues.filter((i) => i.level === "error").length;
  return errors ? `${errors} error(s)` : `Passed${issues.length ? ` with ${issues.length} warning(s)` : ""}`;
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
  return stripWrapperFolder([...out.values()]);
}
