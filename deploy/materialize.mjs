#!/usr/bin/env node
// Materializes the sealed secrets of one environment into per-key files, the way `starci app secret materialize` (canon a14) does.
// After the canon repin this file is replaced by that command; until then it is the same flow on plain sops.
//
//   SOPS_AGE_KEY=... node deploy/materialize.mjs files  --env production --out <dir>
//   SOPS_AGE_KEY=... node deploy/materialize.mjs public --env production
//
// files   decrypts .starcistacks/<env>/secrets/{api,auth,stack}.enc and writes, under <dir>:
//           api/<KEY>       one file per key the api reads (exact bytes, no trailing newline added)
//           stack/<KEY>     one file per key of the OpenClaw / n8n stack
//           api.env         `<KEY>_FILE=/run/secrets/<KEY>` pointer lines (names and paths only, no value)
//           stack.env       `KEY=value` lines of the NON-secret stack settings (image tags, binds, thresholds) for compose interpolation
//           openclaw.env    the gateway token and model-provider keys OpenClaw reads from its environment (its image has no *_FILE support)
//         The only things printed are key names. Values never reach stdout, stderr or the process list.
// public  prints `KEY=value` for the two public web build values from web.enc (Supabase URL and anon key), for web-deploy.yml.
//
// SOPS_AGE_KEY must be in the environment of this process (the protected GitHub environment secret); sops reads it from there.
import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MOUNT = "/run/secrets"
const KEY_NAME = /^[A-Z][A-Z0-9_]*$/u

/** Keys of stack.enc the api container also reads (one secret, one member: the file is copied, never re-sealed). */
const API_FROM_STACK = ["OPENCLAW_GATEWAY_TOKEN", "OPENCLAW_MANAGE_AGENTS"]
/** Keys of stack.enc that are secrets for the n8n / OpenClaw containers. */
const STACK_SECRETS = ["OPENCLAW_GATEWAY_TOKEN", "N8N_ENCRYPTION_KEY", "N8N_DB_PASSWORD"]
/** Model-provider keys OpenClaw reads from its process environment. */
const PROVIDER_KEYS = ["OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]
/** Non-secret stack settings compose interpolates; every other key of stack.enc is ignored on purpose. */
const STACK_SETTINGS = [
    "OPENCLAW_IMAGE",
    "OPENCLAW_TAG",
    "OPENCLAW_MODEL",
    "N8N_TAG",
    "N8N_ALLOWED_HOSTS",
    "API_BIND",
    "JOBS_FAILED_ALERT",
    "JOBS_STALE_SECONDS",
]
/** The only web.enc values the build needs (both are public by design). */
const WEB_PUBLIC = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]

const fail = (message) => {
    process.stderr.write(`materialize: ${message}\n`)
    process.exit(1)
}

/** Decrypts one sealed dotenv member into an object; sops reads SOPS_AGE_KEY from this process environment. */
const open = (env, slug) => {
    const file = join(ROOT, ".starcistacks", env, "secrets", `${slug}.enc`)
    const run = spawnSync("sops", ["decrypt", "--input-type", "dotenv", "--output-type", "json", file], {
        encoding: "utf8",
        maxBuffer: 1 << 24,
    })
    if (run.error) fail(`cannot run sops (${run.error.message})`)
    if (run.status !== 0) fail(`sops could not decrypt ${slug}.enc (is SOPS_AGE_KEY set to the recipient key?)`)
    const parsed = JSON.parse(run.stdout)
    const out = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") out[key] = value
    }
    return out
}

const writeKey = (dir, key, value) => {
    const file = join(dir, key)
    writeFileSync(file, value, { mode: 0o444 })
    chmodSync(file, 0o444)
}

const pick = (members, keys) => {
    const out = {}
    for (const key of keys) if (members[key] !== undefined && members[key] !== "") out[key] = members[key]
    return out
}

const args = process.argv.slice(2)
const mode = args[0]
const flag = (name) => {
    const at = args.indexOf(name)
    return at < 0 ? undefined : args[at + 1]
}
const env = flag("--env") ?? "production"
if (!/^[a-z][a-z0-9-]*$/u.test(env)) fail("--env must be a lowercase environment name")

if (mode === "public") {
    const web = open(env, "web")
    for (const key of WEB_PUBLIC) {
        if (!web[key]) fail(`web.enc has no ${key}`)
        if (/[\r\n]/u.test(web[key])) fail(`${key} must be one line`)
        process.stdout.write(`${key}=${web[key]}\n`)
    }
    process.exit(0)
}

if (mode !== "files") fail("usage: materialize.mjs files|public --env <env> [--out <dir>]")
const out = flag("--out")
if (!out) fail("files needs --out <dir>")

const api = { ...open(env, "api"), ...open(env, "auth") }
const stack = open(env, "stack")
const apiFiles = {
    ...api,
    ...pick(
        stack,
        API_FROM_STACK.filter((key) => api[key] === undefined),
    ),
}
const stackFiles = pick(stack, STACK_SECRETS)
const providers = pick({ ...stack, ...api }, PROVIDER_KEYS)
const openclawEnv = { ...pick(stack, ["OPENCLAW_GATEWAY_TOKEN"]), ...providers }

const skipped = []
const valid = (files) =>
    Object.fromEntries(
        Object.entries(files).filter(([key]) => {
            if (KEY_NAME.test(key) && !key.endsWith("_FILE")) return true
            skipped.push(key)
            return false
        }),
    )

const base = resolve(out)
const layout = { api: valid(apiFiles), stack: valid(stackFiles) }
mkdirSync(base, { recursive: true, mode: 0o711 })
chmodSync(base, 0o711)
for (const [group, files] of Object.entries(layout)) {
    const dir = join(base, group)
    mkdirSync(dir, { recursive: true, mode: 0o755 })
    chmodSync(dir, 0o755)
    for (const [key, value] of Object.entries(files)) writeKey(dir, key, value)
}

writeFileSync(
    join(base, "api.env"),
    `${Object.keys(layout.api)
        .sort()
        .map((key) => `${key}_FILE=${MOUNT}/${key}`)
        .join("\n")}\n`,
    { mode: 0o644 },
)
const settings = pick(stack, STACK_SETTINGS)
for (const [key, value] of Object.entries(settings)) {
    if (/[\r\n"'\\$]/u.test(value)) fail(`${key} must be a plain one-line value`)
}
writeFileSync(
    join(base, "stack.env"),
    `${Object.entries(settings)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}\n`,
    { mode: 0o644 },
)
const providerLines = Object.entries(openclawEnv).map(([key, value]) => {
    if (/[\r\n]/u.test(value)) fail(`${key} must be one line`)
    return `${key}=${value}`
})
writeFileSync(join(base, "openclaw.env"), `${providerLines.join("\n")}${providerLines.length > 0 ? "\n" : ""}`, {
    mode: 0o600,
})

process.stdout.write(
    `materialize: ${env}: api ${Object.keys(layout.api).length} keys, stack ${Object.keys(layout.stack).length} keys, ` +
        `${Object.keys(settings).length} settings, ${Object.keys(openclawEnv).length} openclaw env keys` +
        `${skipped.length > 0 ? `; skipped (not an env name): ${skipped.join(", ")}` : ""}\n`,
)
