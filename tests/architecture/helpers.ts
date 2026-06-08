// Helpers for the architecture gates. Implemented with Node's built-in fs glob
// (Node 22+) so no extra dependency is required.
import { globSync, readFileSync } from "node:fs";

const IMPORT_RE =
  /(?:import|export)[^"']*from\s*["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

/** All `.ts`/`.tsx` files under a layer glob, e.g. "apps/api/src/modules/*\/domain". */
export function filesInLayer(layerGlob: string): string[] {
  return globSync(`${layerGlob}/**/*.{ts,tsx}`);
}

/** All files matching an arbitrary glob, e.g. "apps/web/**\/*.atom.tsx". */
export function filesMatching(pattern: string): string[] {
  return globSync(pattern);
}

function importSpecifiers(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  for (const match of src.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (spec) specifiers.push(spec);
  }
  return specifiers;
}

/**
 * True if `file` imports from any of the forbidden targets. A target is matched
 * as a path segment ("infrastructure") or, when it contains "*", as a filename
 * suffix ("*.molecule.tsx" -> import path ends with ".molecule" / ".molecule.tsx").
 */
export function importsFrom(file: string, forbidden: string[]): boolean {
  const specifiers = importSpecifiers(file);
  return specifiers.some((spec) =>
    forbidden.some((target) => {
      if (target.includes("*")) {
        const suffix = target.replace(/^\*/, "").replace(/\.tsx$/, "");
        return spec.endsWith(suffix) || spec.endsWith(`${suffix}.tsx`);
      }
      return spec.split("/").includes(target);
    }),
  );
}
