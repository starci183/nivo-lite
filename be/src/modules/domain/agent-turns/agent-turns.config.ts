import type { EnvSource } from "@modules/platform/config"
import type { AgentTurnsOptions } from "./agent-turns.options"

/** Reads the agent turn configuration: the bridge secret is optional, and without it no bridge call is admitted. */
export const parseAgentTurnsConfig = (env: EnvSource): AgentTurnsOptions => ({
    bridgeSecret: env.has("OPENCLAW_BRIDGE_SECRET") ? env.secret("OPENCLAW_BRIDGE_SECRET") : null,
})
