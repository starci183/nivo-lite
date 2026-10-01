import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";

export type SyncFile = { readonly path: string; readonly content: string };
export type FileMeta = { readonly path: string; readonly bytes: number; readonly sha256: string };

/** The files this writer owns inside a workspace. Anything else there (memory/, files the agent wrote itself) is never touched. */
const MANIFEST = ".nivo-managed.json";

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

/** One hash over every file (path and content), independent of order: equal hash = equal workspace. */
export const contentHash = (files: ReadonlyArray<SyncFile>): string => {
  const h = createHash("sha256");
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) h.update(`${f.path}\u0000${f.content}\u0000`);
  return h.digest("hex");
};

export const metaOf = (files: ReadonlyArray<SyncFile>): ReadonlyArray<FileMeta> => files.map((f) => ({ path: f.path, bytes: Buffer.byteLength(f.content), sha256: sha(f.content) }));

/** A path from the bundle must stay inside the workspace: relative, no "..", never the manifest. */
const safe = (root: string, rel: string): string => {
  const clean = normalize(rel);
  if (!rel || clean.startsWith("..") || clean.startsWith(sep) || /^[a-z]:/i.test(clean) || clean === MANIFEST || clean.includes(`..${sep}`)) throw new Error(`unsafe workspace path: ${rel}`);
  return join(root, clean);
};

const atomicWrite = (file: string, content: string): void => {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, content, { mode: 0o644 });
  renameSync(tmp, file);
};

const managedOf = (root: string): Array<string> => {
  try {
    const v: unknown = JSON.parse(readFileSync(join(root, MANIFEST), "utf8"));
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** True when every file is on disk with exactly this content and nothing managed is left over. */
export const workspaceMatches = (root: string, files: ReadonlyArray<SyncFile>): boolean => {
  const want = new Set(files.map((f) => f.path));
  if (managedOf(root).some((p) => !want.has(p))) return false;
  return files.every((f) => {
    try {
      return readFileSync(safe(root, f.path), "utf8") === f.content;
    } catch {
      return false;
    }
  });
};

const prune = (root: string, start: string): void => {
  let dir = start;
  while (dir.length > root.length && existsSync(dir) && readdirSync(dir).length === 0) {
    rmdirSync(dir);
    dir = dirname(dir);
  }
};

/**
 * Write the bundle into the workspace one-way: every file through temp + rename (the agent never reads a half-written file), files the
 * previous sync wrote that the bundle no longer has are removed, and the managed list is recorded in a small manifest.
 */
export const writeWorkspace = (root: string, files: ReadonlyArray<SyncFile>): { readonly written: number; readonly removed: number } => {
  mkdirSync(root, { recursive: true });
  let written = 0;
  for (const f of files) {
    const target = safe(root, f.path);
    let same = false;
    try {
      same = readFileSync(target, "utf8") === f.content;
    } catch {
      same = false;
    }
    if (!same) {
      atomicWrite(target, f.content);
      written++;
    }
  }
  const want = new Set(files.map((f) => f.path));
  let removed = 0;
  for (const old of managedOf(root)) {
    if (want.has(old)) continue;
    const target = safe(root, old);
    rmSync(target, { force: true });
    prune(root, dirname(target));
    removed++;
  }
  atomicWrite(join(root, MANIFEST), JSON.stringify(files.map((f) => f.path).sort(), null, 2));
  return { written, removed };
};
