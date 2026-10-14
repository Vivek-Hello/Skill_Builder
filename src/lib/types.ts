export type SkillFile = {
  path: string;
  content: string;
};

export type SkillAnalysis = {
  name: string;
  summary: string;
  keywords: string[];
  triggers: string[];
};

export type Candidate = {
  repo: string; // owner/name
  path: string; // path to SKILL.md inside the repo
  url: string;
  stars: number;
  license: string | null;
  name: string;
  description: string;
  source: "github" | "web";
};

export type MatchVerdict = {
  index: number; // -1 when nothing matches
  score: number; // 0-100
  reason: string;
};

export type ValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export type BuildResult = {
  origin: "cloned" | "generated";
  skillName: string;
  files: SkillFile[];
  issues: ValidationIssue[];
  match?: Candidate & { score: number; reason: string };
  // Close matches we found but didn't clone (low score or restrictive license)
  related: (Candidate & { note: string })[];
};

export type BuildEvent =
  | { type: "step"; step: StepId; status: "running" | "done" | "skipped"; detail?: string }
  | { type: "result"; result: BuildResult }
  | { type: "error"; message: string };

export type StepId = "analyze" | "search" | "match" | "clone" | "generate" | "validate";
