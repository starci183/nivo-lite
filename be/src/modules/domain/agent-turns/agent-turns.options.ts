import type { Secret } from "@modules/platform/config"

/** What the agent turns need from the app root. */
export interface AgentTurnsOptions {
    /** The secret that signs the calls of the OpenClaw bridge plugin; null refuses every bridge call. */
    readonly bridgeSecret: Secret | null
}
