// Example architecture gate (using dependency-cruiser or ts-arch).
// Enforces the DDD dependency rule from constitution.md.
import { expect, it } from "vitest";
import { filesInLayer, importsFrom } from "./helpers"; // implement with your tool

it("domain layer has no outward dependencies", () => {
  for (const file of filesInLayer("apps/api/src/modules/*/domain")) {
    expect(importsFrom(file, ["infrastructure", "presentation"])).toBe(false);
  }
});

it("application layer depends only on domain", () => {
  for (const file of filesInLayer("apps/api/src/modules/*/application")) {
    expect(importsFrom(file, ["infrastructure", "presentation"])).toBe(false);
  }
});
