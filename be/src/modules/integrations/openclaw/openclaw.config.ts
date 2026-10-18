import type { EnvSource } from "@modules/platform/config"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import type { OpenclawAuth, OpenclawGatewayOptions, OpenclawOptions } from "./openclaw.options"

const GATEWAY_PROTOCOLS: ReadonlySet<string> = new Set(["ws:", "wss:"])
const DEFAULT_GATEWAY_STATE_DIR = "/home/node/.openclaw"
const TURN_TIMEOUT_MIN_MS = 5000
const TURN_TIMEOUT_MAX_MS = 600_000
const TURN_TIMEOUT_DEFAULT_MS = 90_000
const SETTLE_DEFAULT_MS = 3000

const authOf = (env: EnvSource): OpenclawAuth | null => {
    if (env.has("OPENCLAW_GATEWAY_TOKEN")) return { kind: "token", token: env.secret("OPENCLAW_GATEWAY_TOKEN") }
    if (env.has("OPENCLAW_GATEWAY_PASSWORD")) {
        return { kind: "password", password: env.secret("OPENCLAW_GATEWAY_PASSWORD") }
    }
    return null
}

const invalid = (key: string): OpenclawError =>
    new OpenclawError({ code: OpenclawErrorCode.ConfigInvalid, params: { key } })

const gatewayOf = (env: EnvSource): OpenclawGatewayOptions | null => {
    const auth = authOf(env)
    if (!env.has("OPENCLAW_GATEWAY_URL") || auth === null) return null
    const url = env.url("OPENCLAW_GATEWAY_URL")
    if (!GATEWAY_PROTOCOLS.has(new URL(url).protocol)) throw invalid("OPENCLAW_GATEWAY_URL")
    return { url, auth }
}

const turnTimeoutOf = (env: EnvSource): number => {
    const value = env.duration("OPENCLAW_TURN_TIMEOUT", TURN_TIMEOUT_DEFAULT_MS)
    if (value < TURN_TIMEOUT_MIN_MS || value > TURN_TIMEOUT_MAX_MS) throw invalid("OPENCLAW_TURN_TIMEOUT")
    return value
}

/** Reads the OpenClaw configuration: the gateway is optional, so a missing address or credential means "not configured". */
export const parseOpenclawConfig = (env: EnvSource): OpenclawOptions => ({
    gateway: gatewayOf(env),
    turnTimeoutMs: turnTimeoutOf(env),
    settleMs: env.duration("OPENCLAW_SETTLE_DELAY", SETTLE_DEFAULT_MS),
    configDir: env.optional("OPENCLAW_CONFIG_DIR"),
    gatewayStateDir: stateDirectoryOf(env),
    manageAgents: env.bool("OPENCLAW_MANAGE_AGENTS", false),
    toolSecret: env.has("OPENCLAW_TOOL_SECRET") ? env.secret("OPENCLAW_TOOL_SECRET") : null,
})

/** The gateway mount root without trailing separators; keeps its configured path otherwise. */
const stateDirectoryOf = (env: EnvSource): string => {
    const value = env.optional("OPENCLAW_GATEWAY_STATE_DIR") ?? DEFAULT_GATEWAY_STATE_DIR
    let end = value.length
    while (end > 0 && value[end - 1] === "/") end -= 1
    return value.slice(0, end)
}
