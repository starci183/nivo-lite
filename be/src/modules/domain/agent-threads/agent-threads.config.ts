import type { EnvSource } from "@modules/platform/config"
import type { AgentThreadsOptions } from "./agent-threads.options"

const APPROVAL_DEADLINE = "AGENT_THREADS_APPROVAL_DEADLINE_MS"

const OWNER_DEADLINE = "AGENT_THREADS_OWNER_DEADLINE_MS"

/**
 * Reads the thread runs' configuration: three tunables, `AGENT_THREADS_GRAPHS_MAX`, `AGENT_THREADS_APPROVAL_DEADLINE_MS` and
 * `AGENT_THREADS_OWNER_DEADLINE_MS` (the windows of the stops' deadlines; absent takes 24 hours and 3 days). Every workflow runs on
 * threads: the former engine flags are not read, a stale value is ignored.
 */
export const parseAgentThreadsConfig = (env: EnvSource): AgentThreadsOptions => {
    return {
        graphsMax: env.has("AGENT_THREADS_GRAPHS_MAX") ? env.int("AGENT_THREADS_GRAPHS_MAX") : undefined,
        approvalDeadlineMs: env.has(APPROVAL_DEADLINE) ? env.int(APPROVAL_DEADLINE) : undefined,
        ownerDeadlineMs: env.has(OWNER_DEADLINE) ? env.int(OWNER_DEADLINE) : undefined,
        doors: true,
    }
}
