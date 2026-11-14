#!/usr/bin/env node
// `npm run ext:all`: the whole project extension of ext/manifest.json, each step run even when an earlier one fails, exit 1 when any failed.
//   1. the manifest against the harness loader's refusal list   (node ext/support/validate-manifest.mjs)
//   2. the RuleTester specs of the lint rules                    (node --test "ext/tests/*.spec.mjs")
//   3. the lint rules over their appliesTo                       (node ext/support/run-lint.mjs)
//   4. the checks and the hfs rules                              (node ext/support/run-checks.mjs)
import { spawnSync } from "node:child_process"
import { ROOT } from "./program.mjs"

const steps = [
    ["ext manifest", [process.execPath, "ext/support/validate-manifest.mjs"]],
    ["ext test", [process.execPath, "--test", "ext/tests/*.spec.mjs"]],
    ["ext lint", [process.execPath, "ext/support/run-lint.mjs"]],
    ["ext check", [process.execPath, "ext/support/run-checks.mjs"]],
]
const failed = []
for (const [name, [command, ...args]] of steps) {
    const ok = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" }).status === 0
    console.log(`${name}: ${ok ? "OK" : "FAILED"}`)
    if (!ok) failed.push(name)
}
if (failed.length > 0) {
    console.error(`ext all: FAILED ${failed.join(", ")}`)
    process.exit(1)
}
console.log("ext all: OK")
