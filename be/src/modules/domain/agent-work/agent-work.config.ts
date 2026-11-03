import type { EnvSource } from "@modules/platform/config"
import { DEFAULT_DEBOUNCE_MAX_MS, DEFAULT_DEBOUNCE_MS } from "./agent-work.policy"
import type { AgentWorkOptions } from "./agent-work.options"

/**
 * Reads the burst window of a conversation: AGENT_BURST_WINDOW is how long it must be quiet before the agent answers the messages it got
 * (default 6s), AGENT_BURST_MAX_WAIT is the longest a burst may keep the agent waiting (default 20s). Both take a duration; 0 turns the window off.
 */
export const parseAgentWorkConfig = (env: EnvSource): Pick<AgentWorkOptions, "debounceMs" | "debounceMaxMs"> => ({
    debounceMs: env.duration("AGENT_BURST_WINDOW", DEFAULT_DEBOUNCE_MS),
    debounceMaxMs: env.duration("AGENT_BURST_MAX_WAIT", DEFAULT_DEBOUNCE_MAX_MS),
})
