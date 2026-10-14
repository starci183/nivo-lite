#!/usr/bin/env node
// Removes the managed Swarm secrets and configs that neither the current nor the previous accepted release names. A name is never reused and
// an earlier version is never deleted before convergence, so this runs only after a release was accepted. Docker refuses to remove an object a
// service still uses; such a refusal is reported and left alone.
//
//   DOCKER_HOST=ssh://vps node deploy/swarm/prune.mjs --keep <release.json> [--keep <release.json>]
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

const keepFiles = process.argv.slice(2).flatMap((arg, index, all) => (all[index - 1] === "--keep" ? [arg] : []))
if (keepFiles.length === 0) {
    process.stderr.write("prune: --keep <release.json> is required (at least the accepted release)\n")
    process.exit(1)
}
const keep = new Set()
for (const file of keepFiles) {
    const release = JSON.parse(readFileSync(file, "utf8"))
    for (const secret of release.secrets) keep.add(secret.runtimeName)
    for (const config of release.configs) keep.add(config.name)
}
const docker = (dockerArgs) => spawnSync("docker", dockerArgs, { encoding: "utf8" })
let removed = 0
let busy = 0
for (const kind of ["secret", "config"]) {
    const list = docker([kind, "ls", "--filter", "label=nivo.managed=true", "--format", "{{.Name}}"])
    if (list.status !== 0) {
        process.stderr.write(`prune: docker ${kind} ls failed\n`)
        process.exit(1)
    }
    for (const name of list.stdout.split(/\r?\n/u).filter(Boolean)) {
        if (keep.has(name)) continue
        if (docker([kind, "rm", name]).status === 0) removed += 1
        else busy += 1
    }
}
process.stdout.write(`prune: removed ${removed} superseded objects, ${busy} still in use\n`)
