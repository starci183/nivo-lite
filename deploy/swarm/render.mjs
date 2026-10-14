#!/usr/bin/env node
// Renders the production Swarm stack: the committed source (.starcistacks/production/infra/swarm/stack.yaml) plus a generated override
// that adds the api environment, the `<KEY>_FILE` pointers and the versioned secret grants, resolved by `docker stack config`.
//
//   SOPS_AGE_KEY=... node deploy/swarm/render.mjs --api-image ghcr.io/o/nivo-lite-api@sha256:... --web-image ghcr.io/o/nivo-lite-web@sha256:... \
//        --source-sha <git sha> --out <dir> [--previous <release digest>] [--secrets-dir <dir>]
//
// Writes under <dir>: stack.yaml (the rendered review model; its sha256 is the release digest), stack.generated.yaml (the override, JSON),
// release.json (the release record: digests, secret and config runtime names, non-secret config digest, health assertions), and the config
// objects' file copies are NOT written (provision.mjs reads the committed files). No secret value reaches a file or the output; only names do.
import { mkdirSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, resolve } from "node:path"
import { COMPOSE_DIR, ROOT, STACK, configObjects, fail, loadSealed, parseConf, sha } from "./lib.mjs"
import { hasPlaceholderDigest, isImageReference } from "./digest.mjs"

const args = process.argv.slice(2)
const flag = (name) => {
    const at = args.indexOf(name)
    return at < 0 ? undefined : args[at + 1]
}
// --allow-unpinned and --extra-compose exist for a local throwaway swarm (stand-in images); a production render never uses them.
const allowUnpinned = args.includes("--allow-unpinned")
const extraCompose = args.flatMap((arg, index, all) => (all[index - 1] === "--extra-compose" ? [resolve(arg)] : []))
const apiImage = flag("--api-image")
const webImage = flag("--web-image")
if (!isImageReference(apiImage, allowUnpinned))
    fail("--api-image must be a registry reference pinned by @sha256 digest")
if (!isImageReference(webImage, allowUnpinned))
    fail("--web-image must be a registry reference pinned by @sha256 digest")
const out = resolve(flag("--out") ?? fail("--out <dir> is required"))
const secretsDir = resolve(flag("--secrets-dir") ?? join(ROOT, ".starcistacks", "production", "secrets"))
const sourceSha = flag("--source-sha") ?? "unknown"

const sealed = loadSealed(secretsDir)
const configs = configObjects()
const mode = 0o444

const grant = (keys) => keys.map((key) => ({ source: key, target: key, mode }))
const escapeDollar = (value) => value.replaceAll("$", "$$$$")

const publicConf = parseConf(join(COMPOSE_DIR, "api-public.conf"))
const settings = sealed.settings
const apiEnvironment = {
    ...publicConf,
    PORT: "8787",
    OPENCLAW_GATEWAY_URL: "ws://openclaw:18790",
    OPENCLAW_CONFIG_DIR: "/openclaw-state",
    OPENCLAW_GATEWAY_STATE_DIR: "/home/node/.openclaw",
    N8N_ALLOWED_HOSTS: settings.N8N_ALLOWED_HOSTS ?? "n8n",
    JOBS_ALERT_FAILED_MAX: settings.JOBS_FAILED_ALERT ?? "20",
    JOBS_ALERT_STALE_SECONDS: settings.JOBS_STALE_SECONDS ?? "300",
}
for (const key of sealed.grants.api) apiEnvironment[`${key}_FILE`] = `/run/secrets/${key}`
for (const key of Object.keys(apiEnvironment)) apiEnvironment[key] = escapeDollar(String(apiEnvironment[key]))

const model = settings.OPENCLAW_MODEL ?? "openrouter/deepseek/deepseek-v4-flash"
const override = {
    services: {
        api: { image: apiImage, environment: apiEnvironment, secrets: grant(sealed.grants.api) },
        web: { image: webImage },
        openclaw: { environment: { OPENCLAW_MODEL: escapeDollar(model) }, secrets: grant(sealed.grants.openclaw) },
        n8n: { secrets: grant(sealed.grants.n8n) },
    },
    secrets: Object.fromEntries(
        Object.entries(sealed.secrets).map(([key, entry]) => [key, { external: true, name: entry.runtimeName }]),
    ),
}

mkdirSync(out, { recursive: true })
const overrideFile = join(out, "stack.generated.yaml")
writeFileSync(overrideFile, `${JSON.stringify(override, null, 2)}\n`)

// `docker stack config` is the renderer: it merges, interpolates and prints the model the deploy applies. It gets a minimal environment, never
// SOPS_AGE_KEY, and no daemon connection.
const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    DOCKER_CONFIG: process.env.DOCKER_CONFIG,
    ACME_EMAIL: process.env.ACME_EMAIL ?? "",
    NIVO_API_IMAGE: apiImage,
    NIVO_WEB_IMAGE: webImage,
}
for (const config of configs) env[config.env] = config.name
for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key]
const rendered = spawnSync(
    "docker",
    [
        "stack",
        "config",
        "-c",
        join(COMPOSE_DIR, "stack.yaml"),
        "-c",
        overrideFile,
        ...extraCompose.flatMap((file) => ["-c", file]),
    ],
    {
        encoding: "utf8",
        env,
        maxBuffer: 1 << 24,
    },
)
if (rendered.error) fail(`cannot run docker (${rendered.error.message})`)
if (rendered.status !== 0)
    fail(`docker stack config failed: ${rendered.stderr.trim().split("\n").slice(0, 6).join(" | ")}`)
const stackBytes = rendered.stdout
if (hasPlaceholderDigest(stackBytes)) fail("rendered stack still carries a placeholder digest")
writeFileSync(join(out, "stack.yaml"), stackBytes)

const releaseDigest = sha(stackBytes)
const configDigest = sha(
    JSON.stringify({
        publicConf,
        settings: Object.fromEntries(Object.entries(settings).sort()),
        configs: configs.map((c) => c.name),
        acme: env.ACME_EMAIL,
    }),
)
const release = {
    schema: "nivo/release@1",
    stack: STACK,
    releaseDigest,
    sourceSha,
    images: { api: apiImage, web: webImage, thirdParty: "pinned by digest in stack.yaml" },
    configDigest,
    configs: configs.map((c) => ({ logical: c.logical, name: c.name })),
    secrets: Object.entries(sealed.secrets)
        .map(([key, entry]) => ({ key, runtimeName: entry.runtimeName }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    migration: "database migrations are applied by db-deploy.yml before this release; this deploy runs none",
    backup: "volumes and Swarm state are backed up by deploy/swarm/backup.sh; Supabase by its own PITR",
    healthAssertions: [
        "api /healthz",
        "api /readyz",
        "api graphql __typename",
        "web /health/live",
        "jobs watchdog two integers",
        "swarm convergence",
    ],
    previousAccepted: flag("--previous") ?? null,
    renderedAt: new Date().toISOString(),
}
writeFileSync(join(out, "release.json"), `${JSON.stringify(release, null, 2)}\n`)
process.stdout.write(
    `render: release ${releaseDigest.slice(0, 16)}: ${release.secrets.length} secrets, ${configs.length} configs; images pinned\n`,
)
