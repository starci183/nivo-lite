// Mirrors the PURE (I/O-free) knowledge and brain modules and the job contracts of the Next app into the engine, byte for byte below a
// one-line header.
// The engine image is built from engine/ alone (Dockerfile build context) with rootDir src, so it cannot import ../src/lib directly;
// the web files stay the single source of truth and this script keeps the copies identical.
//   node engine/dev/sync-shared.mjs          rewrite the copies from the web sources
//   node engine/dev/sync-shared.mjs --check  exit 1 when a copy drifted (run it before committing a change to one of the sources)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const engine = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(engine, "..", "fe", "apps", "web", "src", "lib");
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

/** Copies outside knowledge-jobs/lib: web path (under src/lib) -> engine path (under engine/src). */
export const SHARED_ELSEWHERE = {
  "jobs/contracts.ts": "platform/pgmq/contracts.ts",
};

const header = (rel) => `// GENERATED from src/lib/${rel} by engine/dev/sync-shared.mjs. Do not edit here: edit the web file and re-run the script.\n`;

const pairs = [
  ...SHARED.map((rel) => [rel, join(out, rel), `engine/src/features/knowledge-jobs/lib/${rel}`]),
  ...Object.entries(SHARED_ELSEWHERE).map(([rel, to]) => [rel, join(engine, "src", to), `engine/src/${to}`]),
];

const check = process.argv.includes("--check");
let drift = 0;
// Line endings are not content: a Windows checkout (core.autocrlf) has CRLF in the working tree and LF in git. Compare and write LF.
const lf = (s) => s.replace(/\r\n/g, "\n");
for (const [rel, target, shown] of pairs) {
  const want = header(rel) + lf(readFileSync(join(web, rel), "utf8"));
  let have = null;
  try { have = lf(readFileSync(target, "utf8")); } catch { /* missing */ }
  if (have === want) continue;
  if (check) {
    drift++;
    console.error(`[sync-shared] out of date: ${shown} (source src/lib/${rel})`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, want);
    console.log(`[sync-shared] wrote ${shown}`);
  }
}
if (check && drift) process.exit(1);
if (check) console.log(`[sync-shared] ${pairs.length} shared files in sync`);
