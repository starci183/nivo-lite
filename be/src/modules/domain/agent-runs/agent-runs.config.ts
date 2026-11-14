import type { EnvSource } from "@modules/platform/config"
import type { AgentRunsOptions } from "./agent-runs.options"

/**
 * Reads the agent runs configuration: `AGENT_RUNS_CONCURRENCY` is how many runs execute at once (default 100, at most 1000);
 * `AGENT_RUNS_WORKSPACE_CONCURRENCY` how many of them one workspace may hold (default: all of them).
 */
export const parseAgentRunsConfig = (env: EnvSource): AgentRunsOptions => ({
    concurrency: env.has("AGENT_RUNS_CONCURRENCY") ? env.int("AGENT_RUNS_CONCURRENCY") : undefined,
    workspaceConcurrency: env.has("AGENT_RUNS_WORKSPACE_CONCURRENCY") ? env.int("AGENT_RUNS_WORKSPACE_CONCURRENCY") : undefined,
})
