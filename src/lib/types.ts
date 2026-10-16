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
  origin: "cloned" | "adapted" | "generated";
  skillName: string;
  files: SkillFile[];
  issues: ValidationIssue[];
  // Where a cloned or adapted skill came from
  source?: { repo: string; url: string; license: string | null; stars: number };
  // Every existing skill we found that's at least loosely relevant, best first
  // What was changed when an existing skill was adapted to fit the request
  adaptation?: { changes: string[] };
  matches: ScoredCandidate[];
  // Requests that should trigger the skill, offered as starters in the playground
  examples?: string[];
};

export type BuildEvent =
  | { type: "step"; step: StepId; status: "running" | "done" | "skipped"; detail?: string }
  | { type: "result"; result: BuildResult }
  | { type: "error"; message: string };

export type StepId = "analyze" | "search" | "match" | "clone" | "adapt" | "generate" | "validate";

export type ScoredCandidate = Candidate & {
  score: number;
  reason: string;
  cloneable: boolean; // permissive license, so the user may take a copy
};

export type TestCase = {
  prompt: string;
  criteria: string[];
};

export type TestVerdict = {
  score: number; // 0-100
  passed: boolean;
  feedback: string;
};

export type TestEvent =
  | { type: "status"; message: string }
  | { type: "case"; index: number; status: "running" }
  | {
      type: "case";
      index: number;
      status: "done";
      output: string;
      skillLoaded: boolean;
      toolCalls: number;
      simulated: boolean;
      verdict: TestVerdict;
    }
  | { type: "case"; index: number; status: "error"; message: string }
  | { type: "done"; passed: number; total: number }
  | { type: "error"; message: string };

export type PlaygroundEvent =
  | { type: "text"; text: string }
  | { type: "tool" } // Claude started running code in its container
  | { type: "skill_used" }
  | { type: "done"; messagesLeft: number }
  | { type: "error"; message: string };

export type PlaygroundSession = {
  sessionId: string;
  expiresAt: number;
  sessionsLeft: number;
  simulated: boolean; // Gemini standing in for Claude (no Anthropic key)
};
