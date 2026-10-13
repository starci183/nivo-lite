#!/usr/bin/env node
// Pushes secrets.env to the GitHub environment "production" (three secrets, one per runtime, so no container sees another one's keys):
//   ENGINE_ENV  the [stack] block (the legacy name [engine] is still read): the VPS docker stack's .env - OpenClaw, n8n, binds, watchdog thresholds
//   API_ENV     the api runtime environment (deploy/stack/api.env): the [api] block, plus every server-side key of the [app] block and the
//               knowledge keys inherited from it that [api] does not set itself (so each secret is kept in ONE place)
//   WEB_ENV     the web container's runtime env_file: public NEXT_PUBLIC_* values only (the service role never reaches the web)
//   WEB_NEXT_PUBLIC_* build args baked into the client bundle (public values, kept as secrets for one place to manage)
// Usage: node scripts/env-sync.mjs            -> updates the secrets (needs gh logged in)
//        node scripts/env-sync.mjs --check    -> only prints how many variables would be pushed and which required names are empty
//        node scripts/env-sync.mjs --write-web <file>  -> writes the WEB_ENV content to a local file (manual bootstrap of ~/nivo-web/.env)
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..")
const text = readFileSync(process.env.NIVO_SECRETS || join(repo, "secrets.env"), "utf8")
const sections = {}
let current = ""
for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^# -+ \[(\w+)\]/)
    if (head) current = head[1]
    else if (current && /^[A-Z0-9_]+=/.test(line)) (sections[current] ||= []).push(line)
}
const kv = (line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).replace(/^["']|["']$/g, "")]
const mapOf = (lines) => new Map((lines ?? []).map(kv))

const stack = mapOf(sections.stack ?? sections.engine)
if (!stack.size) throw new Error("no [stack] block (or legacy [engine] block) found in secrets.env")
const app = mapOf(sections.app)
if (!app.size) throw new Error("no [app] block found in secrets.env")
const apiBlock = mapOf(sections.api)
if (!apiBlock.size)
    throw new Error(
        "no [api] block found in secrets.env: copy it from secrets.example.env (PRIMARY_DB_URL, HTTP_SECURITY_ALLOWED_ORIGINS, ...)",
    )

// Keys the stack container wiring reads but the api must not see, and the other way round.
const STACK_ONLY =
    /^(DOMAIN|ACME_EMAIL|N8N_(ALLOWED_CIDRS|TAG|ENCRYPTION_KEY|DB_PASSWORD|HOST|PROTOCOL|WEBHOOK_URL|SECURE_COOKIE|BIND)|API_BIND|ENGINE_BIND|API_TAG|JOBS_(FAILED_ALERT|STALE_SECONDS)|OPENCLAW_(IMAGE|TAG|MODEL))$/
// Supabase CLI config, not read by any runtime; and the public values live in the web env.
const NEVER_SHIP = /^(SUPABASE_AUTH_EXTERNAL_|VPS_|CLOUDFLARE_|READY_|PERF_)/

// Values that live in [app] or [stack] are inherited when [api] does not set them.
const api = new Map(apiBlock)
const inherit = (name, ...sources) => {
    if (api.get(name)) return
    const found = sources.map((from) => from.get(name)).find(Boolean)
    if (found) api.set(name, found)
}
for (const [k] of app) if (!k.startsWith("NEXT_PUBLIC_") && !NEVER_SHIP.test(k) && !STACK_ONLY.test(k)) inherit(k, app)
for (const k of [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENCLAW_GATEWAY_TOKEN",
    "OPENROUTER_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "N8N_DEFAULT_WEBHOOK_URL",
    "OPENCLAW_TURN_TIMEOUT_MS",
    "OPENCLAW_MANAGE_AGENTS",
    "EMBEDDING_API_KEY",
    "EMBEDDING_MODEL",
    "EMBEDDING_BASE_URL",
    "CHANNEL_TOKEN_KEY",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "JOBS_ENABLED",
    "JOBS_CONCURRENCY",
    "JOBS_WORKSPACE_CONCURRENCY",
])
    inherit(k, stack, app)
// The same Google OAuth client serves the Supabase sign-in and the app's own Google features.
inherit(
    "GOOGLE_OAUTH_CLIENT_ID",
    new Map([["GOOGLE_OAUTH_CLIENT_ID", app.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID")]]),
)
inherit(
    "GOOGLE_OAUTH_CLIENT_SECRET",
    new Map([["GOOGLE_OAUTH_CLIENT_SECRET", app.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET")]]),
)
// The app's DEEPSEEK_API_KEY is really an OpenRouter key.
inherit("OPENROUTER_API_KEY", new Map([["OPENROUTER_API_KEY", app.get("DEEPSEEK_API_KEY")]]))
for (const [k, v] of Object.entries({
    EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
    EMBEDDING_BASE_URL: "https://openrouter.ai/api/v1",
    HTTP_SECURITY_ALLOWED_ORIGINS: "https://nivo.vn,https://www.nivo.vn",
    PRIMARY_DB_SCHEMA: "public",
}))
    if (!api.get(k)) api.set(k, v)

const API_REQUIRED = [
    "PRIMARY_DB_URL",
    "PRIMARY_DB_SCHEMA",
    "HTTP_SECURITY_ALLOWED_ORIGINS",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
]
const STACK_REQUIRED = ["OPENCLAW_GATEWAY_TOKEN", "N8N_ENCRYPTION_KEY", "N8N_DB_PASSWORD"]
const missing = [
    ...API_REQUIRED.filter((k) => !api.get(k)).map((k) => `API_ENV:${k}`),
    ...STACK_REQUIRED.filter((k) => !stack.get(k)).map((k) => `ENGINE_ENV:${k}`),
]
if (missing.length) console.warn(`[env-sync] WARNING: no value for: ${missing.join(", ")} (names only)`)

const quote = (v) => (/[$#\s"]|\\/.test(v) && !v.includes("'") ? `'${v}'` : v)
const lines = (map) => [...map].filter(([, v]) => v !== "").map(([k, v]) => `${k}=${quote(v)}`)
const apiEnv = lines(new Map([...api].filter(([k]) => !NEVER_SHIP.test(k) && !STACK_ONLY.test(k))))
// API_TAG is written by the deploy workflow; a stale value in the secret would only be overwritten.
const stackEnv = lines(new Map([...stack].filter(([k]) => k !== "API_TAG")))

// Web: public values only. The Picker's public client id is the same client id (public by nature).
const web = new Map([...app].filter(([k]) => k.startsWith("NEXT_PUBLIC_")))
if (!web.get("NEXT_PUBLIC_GOOGLE_CLIENT_ID"))
    web.set("NEXT_PUBLIC_GOOGLE_CLIENT_ID", api.get("GOOGLE_OAUTH_CLIENT_ID") ?? "")
web.set("NEXT_PUBLIC_SITE_URL", "https://nivo.vn")
web.set("NEXT_PUBLIC_DEVELOPER_API_URL", app.get("NEXT_PUBLIC_DEVELOPER_API_URL") || "https://api.nivo.vn")
const webEnv = lines(web)

const buildArgs = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_DEMO_LOGIN",
    "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
    "NEXT_PUBLIC_GOOGLE_PICKER_API_KEY",
    "NEXT_PUBLIC_GOOGLE_APP_ID",
]
for (const k of buildArgs.slice(0, 2)) if (!web.get(k)) throw new Error(`${k} missing in the [app] block`)

const wi = process.argv.indexOf("--write-web")
if (wi > 0) {
    writeFileSync(process.argv[wi + 1], webEnv.join("\n") + "\n", { mode: 0o600 })
    console.log(`[env-sync] wrote ${webEnv.length} web variables to ${process.argv[wi + 1]}`)
} else if (process.argv.includes("--check")) {
    console.log(
        `[env-sync] ${stackEnv.length} stack variables, ${apiEnv.length} api variables, ${webEnv.length} web variables, ${buildArgs.length} build args ready (not pushed)`,
    )
} else {
    const set = (name, value) =>
        execFileSync("gh", ["secret", "set", name, "--env", "production", "--repo", "starci183/nivo-lite"], {
            input: value,
            stdio: ["pipe", "inherit", "inherit"],
        })
    set("ENGINE_ENV", stackEnv.join("\n") + "\n")
    console.log(
        `[env-sync] ENGINE_ENV updated (${stackEnv.length} variables). Re-run the "Deploy api" workflow to apply.`,
    )
    set("API_ENV", apiEnv.join("\n") + "\n")
    console.log(`[env-sync] API_ENV updated (${apiEnv.length} variables). Re-run the "Deploy api" workflow to apply.`)
    set("WEB_ENV", webEnv.join("\n") + "\n")
    console.log(`[env-sync] WEB_ENV updated (${webEnv.length} variables). Re-run the "Deploy web" workflow to apply.`)
    for (const k of buildArgs) set(`WEB_${k}`, web.get(k) ?? "")
    console.log(`[env-sync] ${buildArgs.length} web build-arg secrets updated.`)
}
