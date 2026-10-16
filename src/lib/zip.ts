"use client";

import JSZip from "jszip";
import type { SkillFile } from "./types";

// Download a skill as <name>.zip containing a <name>/ folder, the layout Claude expects
export async function downloadSkillZip(name: string, files: SkillFile[]) {
  const zip = new JSZip();
  const folder = zip.folder(name)!;
  for (const f of files) folder.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.zip` });
  a.click();
  URL.revokeObjectURL(url);
}
