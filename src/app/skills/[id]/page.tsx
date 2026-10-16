import { Suspense } from "react";
import { SavedSkillStudio } from "@/features/studio/studio";

// The id comes from the URL at runtime and the skill from browser storage,
// so the shell prerenders and the workspace streams in.
export default function SkillPage() {
  return (
    <Suspense>
      <SavedSkillStudio />
    </Suspense>
  );
}
