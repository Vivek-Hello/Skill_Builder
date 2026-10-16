// How to install a downloaded skill in each Claude product
export function InstallSteps({ slug }: { slug: string }) {
  return (
    <ol className="space-y-3 text-sm">
      <li>
        <p className="font-medium">Claude apps</p>
        <p className="text-muted">
          Download the .zip, then go to <span className="text-foreground">Settings → Capabilities → Skills</span> and
          upload it.
        </p>
      </li>
      <li>
        <p className="font-medium">Claude Code</p>
        <p className="text-muted">Unzip into your skills folder, for all projects or just one:</p>
        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-panel-2 px-3 py-2 font-mono text-xs">
          ~/.claude/skills/{slug}/{"\n"}.claude/skills/{slug}/
        </pre>
      </li>
      <li>
        <p className="font-medium">Claude API</p>
        <p className="text-muted">Upload the folder with the Skills API, then attach it to requests with code execution.</p>
      </li>
    </ol>
  );
}
