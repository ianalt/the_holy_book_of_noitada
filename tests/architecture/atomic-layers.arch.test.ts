// Example architecture gate. Enforces Atomic Design layering from constitution.md.
import { expect, it } from "vitest";
import { filesMatching, importsFrom } from "./helpers"; // implement with your tool

it("atoms do not import higher layers", () => {
  for (const file of filesMatching("apps/web/**/*.atom.tsx")) {
    expect(importsFrom(file, ["*.molecule.tsx", "*.organism.tsx"])).toBe(false);
  }
});

it("molecules do not import organisms", () => {
  for (const file of filesMatching("apps/web/**/*.molecule.tsx")) {
    expect(importsFrom(file, ["*.organism.tsx"])).toBe(false);
  }
});
