#!/usr/bin/env node
// `npm run ext:check`: what `starci app check` will run of ext/manifest.json from hfs 6.9.0 on, outside the lint gate:
//   1. every `checks[]` entry, in order: `node <run>` from the app root with no arguments (the harness's `checks` step, R402: exit 0 green);
//   2. every `rules[]` entry with an `hfs` engine: its module `ext/hfs/<hfs>` loaded by default export and called with a context built like the
//      harness's, `{ api: 1, repoRoot, files, read }`, where `files` are the app's files that `appliesTo` matches (tracked by git, plus the
//      untracked files git does not ignore: this lane is uncommitted, the harness passes tracked files only) and `read(file)` the text of an
//      app-relative file or null (over 1 MiB or absent: null, as the harness's bounded read). Each finding `{ path, message, line?, column? }` is
//      printed under the rule's id and code; a rule that throws or returns a finding without a path and a message fails it (the harness would
//      refuse the whole extension, HFS_EXT_INVALID).
//   node ext/support/run-checks.mjs            every check and every hfs rule
//   node ext/support/run-checks.mjs <id> ...   only the named entries (a check id or a rule id)
// Exit 1 when any entry fails.
import { spawnSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { posix, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { ROOT } from "./program.mjs"

const MAX_READ_BYTES = 1024 * 1024
const manifest = JSON.parse(readFileSync(resolve(ROOT, "ext", "manifest.json"), "utf8"))
const checks = manifest.checks ?? []
const hfsRules = (manifest.rules ?? []).filter((rule) => rule.hfs !== undefined)
const wanted = process.argv.slice(2)
const known = [...checks.map((check) => check.id), ...hfsRules.map((rule) => rule.id)]
const unknown = wanted.filter((id) => !known.includes(id))
if (unknown.length > 0) {
    console.error(`ext checks: no such check or hfs rule: ${unknown.join(", ")}`)
    process.exit(1)
}
const picked = (id) => wanted.length === 0 || wanted.includes(id)

const failed = []
for (const check of checks.filter((entry) => picked(entry.id))) {
    const status = spawnSync(process.execPath, [check.run], { cwd: ROOT, stdio: "inherit" }).status
    const ok = status === 0
    console.log(`ext check ${check.id} (${check.run}): ${ok ? "OK" : `FAILED (exit ${String(status)})`}`)
    if (!ok) failed.push(check.id)
}

const gitList = (args) =>
    spawnSync("git", ["ls-files", "-z", ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
        .stdout.split("\0")
        .filter((file) => file !== "")
const appFiles = [...new Set([...gitList([]), ...gitList(["--others", "--exclude-standard"])])]
const read = (file) => {
    try {
        const target = resolve(ROOT, file)
        return statSync(target).size > MAX_READ_BYTES ? null : readFileSync(target, "utf8")
    } catch {
        return null
    }
}
for (const rule of hfsRules.filter((entry) => picked(entry.id))) {
    const files = Object.freeze(appFiles.filter((file) => rule.appliesTo.some((glob) => posix.matchesGlob(file, glob))))
    const label = `ext hfs ${rule.id} ${rule.code} (ext/hfs/${rule.hfs})`
    let findings
    try {
        const judge = (await import(pathToFileURL(resolve(ROOT, "ext", "hfs", rule.hfs)).href)).default
        findings = judge(Object.freeze({ api: 1, repoRoot: ROOT, files, read }))
    } catch (error) {
        console.error(`${label}: THREW (${String(error?.message ?? error).split("\n")[0]}); the harness refuses the extension for it`)
        failed.push(rule.id)
        continue
    }
    const list = Array.isArray(findings) ? findings : []
    const malformed = list.filter((finding) => typeof finding?.path !== "string" || typeof finding?.message !== "string")
    for (const finding of list.filter((entry) => !malformed.includes(entry)))
        console.error(`  ${rule.severity} ${rule.code} ${finding.path}${finding.line === undefined ? "" : `:${finding.line}`}: ${finding.message} (${rule.id}, ${rule.doc})`)
    if (malformed.length > 0) console.error(`${label}: ${malformed.length} finding(s) without a path and a message`)
    const red = malformed.length > 0 || (rule.severity === "error" && list.length > 0)
    console.log(`${label}: ${red ? "FAILED" : "OK"}, ${files.length} files in scope, ${list.length} findings`)
    if (red) failed.push(rule.id)
}

const ran = checks.filter((entry) => picked(entry.id)).length + hfsRules.filter((entry) => picked(entry.id)).length
if (failed.length > 0) {
    console.error(`ext checks: ${ran - failed.length} OK, FAILED ${failed.join(", ")}`)
    process.exit(1)
}
console.log(`ext checks: ${ran} OK`)
