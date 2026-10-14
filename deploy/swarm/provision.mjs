#!/usr/bin/env node
// Creates the immutable, versioned Swarm secrets and config objects a release names, on the Docker daemon DOCKER_HOST points at (the VPS manager,
// over ssh). Each secret value is decrypted in memory (sops, SOPS_AGE_KEY) and piped to `docker secret create <runtimeName> -` on stdin: it never
// touches the disk, an argument list or the output. A name that already exists is left alone (same value, same name); a name is never reused
// for another value and an earlier version is never removed here (prune.mjs removes versions only after the release is accepted).
//
//   SOPS_AGE_KEY=... DOCKER_HOST=ssh://vps node deploy/swarm/provision.mjs --release <release.json> [--secrets-dir <dir>]
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, resolve } from "node:path"
import { ROOT, configObjects, fail, loadSealed } from "./lib.mjs"

const args = process.argv.slice(2)
const flag = (name) => {
    const at = args.indexOf(name)
    return at < 0 ? undefined : args[at + 1]
}
const releaseFile = flag("--release") ?? fail("--release <release.json> is required")
const secretsDir = resolve(flag("--secrets-dir") ?? join(ROOT, ".starcistacks", "production", "secrets"))
const release = JSON.parse(readFileSync(releaseFile, "utf8"))

const docker = (dockerArgs, input) => spawnSync("docker", dockerArgs, { encoding: "utf8", input, maxBuffer: 1 << 24 })
const names = (kind) => {
    const run = docker([kind, "ls", "--format", "{{.Name}}"])
    if (run.status !== 0) fail(`docker ${kind} ls failed: ${run.stderr.trim().split("\n")[0]}`)
    return new Set(run.stdout.split(/\r?\n/u).filter(Boolean))
}

const sealed = loadSealed(secretsDir)
const haveSecrets = names("secret")
let created = 0
let kept = 0
for (const entry of release.secrets) {
    const secret = sealed.secrets[entry.key]
    if (secret === undefined || secret.runtimeName !== entry.runtimeName) {
        fail(`the sealed custody no longer matches the release record for ${entry.key}; render the release again`)
    }
    if (haveSecrets.has(entry.runtimeName)) {
        kept += 1
        continue
    }
    const run = docker(
        [
            "secret",
            "create",
            "--label",
            "nivo.managed=true",
            "--label",
            `nivo.key=${entry.key}`,
            "--label",
            `nivo.release=${release.releaseDigest.slice(0, 16)}`,
            entry.runtimeName,
            "-",
        ],
        secret.value,
    )
    if (run.status !== 0)
        fail(
            `docker secret create failed for ${entry.key}: ${run.stderr.trim().split("\n")[0].replaceAll(secret.value, "[value]")}`,
        )
    created += 1
}

const haveConfigs = names("config")
const files = new Map(configObjects().map((config) => [config.name, config.file]))
let configsCreated = 0
for (const entry of release.configs) {
    if (haveConfigs.has(entry.name)) continue
    const file = files.get(entry.name)
    if (file === undefined)
        fail(`the config ${entry.name} does not match the committed files; render the release again`)
    const run = docker(
        [
            "config",
            "create",
            "--label",
            "nivo.managed=true",
            "--label",
            `nivo.release=${release.releaseDigest.slice(0, 16)}`,
            entry.name,
            "-",
        ],
        readFileSync(file),
    )
    if (run.status !== 0) fail(`docker config create failed for ${entry.logical}: ${run.stderr.trim().split("\n")[0]}`)
    configsCreated += 1
}
process.stdout.write(`provision: secrets created ${created}, kept ${kept}; configs created ${configsCreated}\n`)
