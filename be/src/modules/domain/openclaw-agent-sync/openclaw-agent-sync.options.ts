/** The options of the openclaw-agent-sync capability. */
export interface OpenclawAgentSyncOptions {
    /** How long to wait after openclaw.json changed before a turn is sent to a new agent, ms. */
    readonly reloadSettleMs: number
}

/** The default reload settle: 2 s (the gateway debounces file changes by 300 ms and then applies them). */
export const OPENCLAW_RELOAD_SETTLE_MS = 2000
