// Writes the gateway settings the stack relies on into openclaw.json before the gateway starts (idempotent merge: other keys, agents and
// plugins that OpenClaw or an operator added are kept). Loopback bind + token auth: the gateway is reached only through the relay.
import fs from "node:fs"

const file = "/home/node/.openclaw/openclaw.json"
let config = {}
try {
    config = JSON.parse(fs.readFileSync(file, "utf8"))
} catch {
    config = {}
}
// The api writes each agent workspace itself (openclaw.sync_agent): no first-run ritual.
config.agents = config.agents || {}
config.agents.defaults = { ...(config.agents.defaults || {}), skipBootstrap: true }
// NIVO owns every trigger and schedule: OpenClaw runs one turn when asked and nothing in the background. `cron.enabled: false` stops its cron
// scheduler (the service also sets OPENCLAW_SKIP_CRON=1); a `defaults.heartbeat` block makes every agent resolve its heartbeat from it, and
// `every: "0m"` gives each no interval, so no agent is scheduled (the default is 30m, which would spend a model call per agent per half hour).
config.cron = { ...(config.cron || {}), enabled: false }
config.agents.defaults.heartbeat = { ...(config.agents.defaults.heartbeat || {}), every: "0m" }
// The one tool an agent has besides session_status is nivo_call, from the bridge plugin mounted at /opt/nivo/nivo-bridge: it runs a NIVO
// tool through the api for the turn that is running. Other plugin paths and entries an operator added are kept.
const bridgePath = "/opt/nivo/nivo-bridge"
const plugins = config.plugins || {}
const load = plugins.load || {}
const paths = Array.isArray(load.paths) ? load.paths : []
config.plugins = {
    ...plugins,
    load: { ...load, paths: paths.includes(bridgePath) ? paths : [...paths, bridgePath] },
    entries: { ...(plugins.entries || {}), "nivo-bridge": { ...((plugins.entries || {})["nivo-bridge"] || {}), enabled: true } },
}
config.session = {
    ...(config.session || {}),
    maintenance: {
        ...((config.session || {}).maintenance || {}),
        mode: "enforce",
        pruneAfter: "7d",
        maxEntries: 400,
        maxDiskBytes: "400mb",
    },
}
config.gateway = {
    ...(config.gateway || {}),
    mode: "local",
    bind: "loopback",
    port: 18789,
    auth: {
        ...((config.gateway || {}).auth || {}),
        mode: "token",
        token: fs.readFileSync(process.env.OPENCLAW_GATEWAY_TOKEN_FILE, "utf8"),
    },
}
// Language models come only from the AI gateway (hosted in the api process): one OpenAI-compatible custom provider, "nivo-ai", with the
// StarCi virtual key it shares with the api. The key stays a reference: openclaw resolves ${STARCI_AI_KEY} from the gateway process environment.
if (process.env.AI_BASE_URL && process.env.STARCI_AI_KEY) {
    const chat = process.env.AI_CHAT_MODEL || "work"
    config.models = {
        ...(config.models || {}),
        mode: "merge",
        providers: {
            ...((config.models || {}).providers || {}),
            "nivo-ai": {
                baseUrl: process.env.AI_BASE_URL,
                apiKey: "${STARCI_AI_KEY}",
                api: "openai-completions",
                models: [{ id: chat, name: chat, input: ["text", "image"] }],
            },
        },
    }
}
const model = process.env.OPENCLAW_MODEL
if (model) {
    config.agents.defaults.model = { ...(config.agents.defaults.model || {}), primary: model }
    // DeepSeek V4 models think by default (hundreds of reasoning tokens, seconds of latency, 2x cost): switch reasoning off.
    const models = (config.agents.defaults.models = config.agents.defaults.models || {})
    const previous = models[model] || {}
    models[model] = {
        ...previous,
        params: {
            ...(previous.params || {}),
            extra_body: { ...((previous.params || {}).extra_body || {}), reasoning: { enabled: false } },
        },
    }
}
fs.mkdirSync("/home/node/.openclaw", { recursive: true })
fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 })
console.log("openclaw.json ready (gateway local/loopback/token" + (model ? ", model " + model : "") + ")")
