import type { EnvSource } from "@modules/platform/config"
import type { AgentRunsOptions } from "./agent-runs.options"

/** Reads the agent runs configuration: `AGENT_RUNS_CONCURRENCY` is how many runs one process drives at once (default 4). */
export const parseAgentRunsConfig = (env: EnvSource): AgentRunsOptions => ({
    concurrency: env.has("AGENT_RUNS_CONCURRENCY") ? env.int("AGENT_RUNS_CONCURRENCY") : undefined,
})
