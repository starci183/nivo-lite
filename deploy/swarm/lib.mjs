// Shared by the Swarm release tools (render.mjs, provision.mjs). It opens the sealed custody members in memory and derives, from NAMES and
// keyed hashes only, which Swarm secret each service is granted. No value is ever written to disk, printed or put in an argument list.
import { createHash, createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const COMPOSE_DIR = join(ROOT, ".starcistacks", "production", "infra", "swarm")
export const STACK = "nivo"

const KEY_NAME = /^[A-Z][A-Z0-9_]*$/u
/** Keys of stack.enc the api container also reads (one secret, one member: never re-sealed). */
const API_FROM_STACK = ["OPENCLAW_GATEWAY_TOKEN", "OPENCLAW_MANAGE_AGENTS"]
/** Model-provider keys the OpenClaw gateway reads from its process environment. */
const PROVIDER_KEYS = ["OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]
/** Secrets only the automation services read. */
const N8N_KEYS = ["N8N_ENCRYPTION_KEY"]
const REQUIRED = ["OPENCLAW_GATEWAY_TOKEN", ...N8N_KEYS]

export const fail = (message) => {
    process.stderr.write(`swarm: ${message}\n`)
    process.exit(1)
}

export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex")

/** Decrypts one sealed dotenv member into an object; sops reads SOPS_AGE_KEY (or its key file) from this process environment. */
export const openMember = (secretsDir, slug) => {
    const file = join(secretsDir, `${slug}.enc`)
    const run = spawnSync("sops", ["decrypt", "--input-type", "dotenv", "--output-type", "json", file], {
        encoding: "utf8",
        maxBuffer: 1 << 24,
    })
    if (run.error) fail(`cannot run sops (${run.error.message})`)
    if (run.status !== 0) fail(`sops could not decrypt ${slug}.enc (is SOPS_AGE_KEY set to the recipient key?)`)
    const out = {}
    for (const [key, value] of Object.entries(JSON.parse(run.stdout))) if (typeof value === "string") out[key] = value
    return out
}

const pick = (members, keys) => {
    const out = {}
    for (const key of keys) if (members[key] !== undefined && members[key] !== "") out[key] = members[key]
    return out
}

/** The key that makes the version suffix of a runtime name unguessable from the name alone: the age identity of the environment. */
const versionKey = () => {
    const key = process.env.NIVO_SECRET_VERSION_KEY || process.env.SOPS_AGE_KEY
    if (!key)
        fail("SOPS_AGE_KEY (or NIVO_SECRET_VERSION_KEY for a local fixture) is needed to version the secret names")
    return key
}

/** `nivo-<key>-v<10 hex of HMAC(key, name + value)>`: a changed value is a new name, an unchanged one keeps its name (no needless task restart). */
export const runtimeName = (key, value) => {
    const version = createHmac("sha256", versionKey()).update(`${key}\0${value}`).digest("hex").slice(0, 10)
    const name = `nivo-${key.toLowerCase().replaceAll("_", "-")}-v${version}`
    if (name.length > 64) fail(`the Swarm secret name for ${key} would exceed 64 characters`)
    return name
}

/**
 * Opens the sealed members and returns what every service is granted: { secrets: { KEY: { runtimeName, value } },
 * grants: { api: [KEY], openclaw: [KEY], n8n: [KEY] }, settings: { NAME: value } }.
 * The caller must not log `value`.
 */
export const loadSealed = (secretsDir) => {
    const api = { ...openMember(secretsDir, "api"), ...openMember(secretsDir, "auth") }
    const stack = openMember(secretsDir, "stack")
    const valid = (files) =>
        Object.fromEntries(Object.entries(files).filter(([key]) => KEY_NAME.test(key) && !key.endsWith("_FILE")))
    const apiFiles = valid({
        ...api,
        ...pick(
            stack,
            API_FROM_STACK.filter((key) => api[key] === undefined),
        ),
    })
    const stackSecrets = valid(pick(stack, ["OPENCLAW_GATEWAY_TOKEN", ...N8N_KEYS]))
    for (const key of REQUIRED) if (stackSecrets[key] === undefined) fail(`stack.enc has no ${key}`)
    const providers = valid(pick({ ...stack, ...api }, PROVIDER_KEYS))
    const values = { ...apiFiles, ...stackSecrets, ...providers }
    const secrets = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, { runtimeName: runtimeName(key, value), value }]),
    )
    const grants = {
        api: Object.keys(apiFiles).sort(),
        openclaw: ["OPENCLAW_GATEWAY_TOKEN", ...Object.keys(providers)].sort(),
        n8n: [...N8N_KEYS],
    }
    const settings = pick(stack, ["OPENCLAW_MODEL", "N8N_ALLOWED_HOSTS", "JOBS_FAILED_ALERT", "JOBS_STALE_SECONDS"])
    for (const [key, value] of Object.entries(settings))
        if (/[\r\n"'\\]/u.test(value)) fail(`${key} must be a plain one-line value`)
    return { secrets, grants, settings }
}

/** The config objects (non-secret files mounted into services), versioned by the content digest. */
export const CONFIG_FILES = [
    { logical: "routes", env: "NIVO_CFG_ROUTES", file: join(COMPOSE_DIR, "edge", "routes.yml") },
    {
        logical: "openclaw-entrypoint",
        env: "NIVO_CFG_OPENCLAW_ENTRYPOINT",
        file: join(COMPOSE_DIR, "openclaw", "entrypoint.sh"),
    },
    {
        logical: "openclaw-init",
        env: "NIVO_CFG_OPENCLAW_INIT",
        file: join(COMPOSE_DIR, "openclaw", "openclaw-init.mjs"),
    },
    {
        logical: "openclaw-relay",
        env: "NIVO_CFG_OPENCLAW_RELAY",
        file: join(COMPOSE_DIR, "openclaw", "openclaw-relay.mjs"),
    },
]

export const configObjects = () =>
    CONFIG_FILES.map((entry) => {
        const bytes = readFileSync(entry.file)
        return { ...entry, name: `nivo-${entry.logical}-c${sha(bytes).slice(0, 10)}` }
    })

/** KEY=VALUE lines of the committed non-secret api configuration (api-public.conf). */
export const parseConf = (file) => {
    const out = {}
    for (const line of readFileSync(file, "utf8").split(/\r?\n/u)) {
        const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line)
        if (match) out[match[1]] = match[2]
    }
    return out
}
