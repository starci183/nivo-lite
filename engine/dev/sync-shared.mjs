// Mirrors the PURE (I/O-free) knowledge and brain modules of the Next app into the engine, byte for byte below a one-line header.
// The engine image is built from engine/ alone (Dockerfile build context) with rootDir src, so it cannot import ../src/lib directly;
// the web files stay the single source of truth and this script keeps the copies identical.
//   node engine/dev/sync-shared.mjs          rewrite the copies from the web sources
//   node engine/dev/sync-shared.mjs --check  exit 1 when a copy drifted (run it before committing a change to one of the sources)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const engine = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(engine, "..", "src", "lib");
const out = join(engine, "src", "features", "knowledge-jobs", "lib");

/** web path (under src/lib) -> engine path (under knowledge-jobs/lib). Same relative layout, so the files' own imports resolve unchanged. */
export const SHARED = [
  "knowledge/chunk.ts",
  "knowledge/ooxml.ts",
  "knowledge/drive.ts",
  "brain/shared.ts",
  "brain/doc-parse.ts",
  "brain/gaps-shared.ts",
];

const header = (rel) => `// GENERATED from src/lib/${rel} by engine/dev/sync-shared.mjs. Do not edit here: edit the web file and re-run the script.\n`;

const check = process.argv.includes("--check");
let drift = 0;
for (const rel of SHARED) {
  const want = header(rel) + readFileSync(join(web, rel), "utf8");
  const target = join(out, rel);
  let have = null;
  try { have = readFileSync(target, "utf8"); } catch { /* missing */ }
  if (have === want) continue;
  if (check) {
    drift++;
    console.error(`[sync-shared] out of date: engine/src/features/knowledge-jobs/lib/${rel} (source src/lib/${rel})`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, want);
    console.log(`[sync-shared] wrote lib/${rel}`);
  }
}
if (check && drift) process.exit(1);
if (check) console.log(`[sync-shared] ${SHARED.length} shared files in sync`);
