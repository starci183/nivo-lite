#!/usr/bin/env node
// ext/manifest.json check `engine-imports` (doc ext/docs/checks/engine-imports.md): the dependency direction. The engine (`be/**`, prod and
// specs) and the front end (`fe/apps/*/src`, `fe/packages/*/src`) import neither @nivo-lite/blocks-core nor @nivo-lite/nivo-web-core, and the
// plugin registry only at the composition roots listed in COMPOSITION_ROOTS; agent-sdk imports none of the three. No build, no arguments; one line per finding `file:line  package`, then the count; exit 1 on any finding.
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { countsByFolder, countsByPackage, engineImportFindings, findingLine } from "../support/engine-imports-rules.mjs"
import { ROOT } from "../support/program.mjs"

const SCOPE = ["be", "fe/apps", "fe/packages", "packages/agent-sdk/src"]
const gitList = (args) =>
    spawnSync("git", ["ls-files", "-z", ...args, "--", ...SCOPE], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
        .stdout.split("\0")
        .filter((file) => file !== "")
// Tracked files and the untracked ones git does not ignore (a lane is uncommitted); a file git lists but that is gone is skipped.
const files = [...new Set([...gitList([]), ...gitList(["--others", "--exclude-standard"])])].sort()

const findings = files.flatMap((file) => {
    let text
    try {
        text = readFileSync(resolve(ROOT, file), "utf8")
    } catch {
        return []
    }
    return engineImportFindings(file, text)
})

for (const finding of findings) console.error(findingLine(finding))
const listed = (counts) =>
    Object.entries(counts)
        .map(([name, count]) => `${name} ${count}`)
        .join(", ")
const byFolder = listed(countsByFolder(findings))
const byPackage = listed(countsByPackage(findings))
console.log(
    `engine imports: ${findings.length} finding(s) in ${files.length} files${byFolder === "" ? "" : ` (by folder: ${byFolder}; by package: ${byPackage})`}`,
)
process.exit(findings.length > 0 ? 1 : 0)
