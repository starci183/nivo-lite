import type { EnvSource } from "@modules/platform/config"
import type { AgentThreadsOptions } from "./agent-threads.options"
import { AgentThreadsError, AgentThreadsErrorCode } from "./errors/agent-threads.error"
import { engineDefaultOf, threadFlagOf, threadWorkflowsOf } from "./thread-flag.policy"

/** The env key of the flag: a comma-separated list of `<moduleKey>.<workflowKey>`. Not declared, or empty: no run starts on a thread. */
export const THREAD_FLAG = "AGENT_ENGINE_LANGGRAPH"

/**
 * The env key of the engine NEW runs start on by default: `legacy` or `langgraph`. Not declared takes `DEFAULT_ENGINE` (the old
 * engine). `langgraph` starts every cleared workflow's new runs on a thread with no flag list; a run already started never moves.
 */
export const ENGINE_DEFAULT_FLAG = "AGENT_ENGINE_DEFAULT"

const APPROVAL_DEADLINE = "AGENT_THREADS_APPROVAL_DEADLINE_MS"

const OWNER_DEADLINE = "AGENT_THREADS_OWNER_DEADLINE_MS"

/**
 * Reads the thread runs' configuration: `AGENT_ENGINE_LANGGRAPH`, the workflows whose new runs start on a LangGraph thread (default:
 * none, the old engine runs everything), and three tunables: `AGENT_THREADS_GRAPHS_MAX`, `AGENT_THREADS_APPROVAL_DEADLINE_MS` and
 * `AGENT_THREADS_OWNER_DEADLINE_MS` (the windows of the stops' deadlines; absent takes 24 hours and 3 days). A name that is not a workflow name or is not
 * cleared for threads yet (`THREAD_READY_WORKFLOWS`) throws `AGENT_THREADS_FLAG_INVALID` naming it, so the app does not start half
 * switched. `AGENT_ENGINE_DEFAULT=langgraph` adds every cleared workflow to the list (default on for new runs); any word but `legacy`
 * or `langgraph` throws the same error naming it.
 */
export const parseAgentThreadsConfig = (env: EnvSource): AgentThreadsOptions => {
    const flag = threadFlagOf(env.optional(THREAD_FLAG))
    if (flag.kind === "invalid")
        throw new AgentThreadsError({ code: AgentThreadsErrorCode.FlagInvalid, params: { name: flag.name } })
    const engine = engineDefaultOf(env.optional(ENGINE_DEFAULT_FLAG))
    if (engine.kind === "invalid")
        throw new AgentThreadsError({ code: AgentThreadsErrorCode.FlagInvalid, params: { name: engine.name } })
    return {
        workflows: threadWorkflowsOf(flag.workflows, engine.engine),
        everyWorkflow: engine.engine === "langgraph",
        graphsMax: env.has("AGENT_THREADS_GRAPHS_MAX") ? env.int("AGENT_THREADS_GRAPHS_MAX") : undefined,
        approvalDeadlineMs: env.has(APPROVAL_DEADLINE) ? env.int(APPROVAL_DEADLINE) : undefined,
        ownerDeadlineMs: env.has(OWNER_DEADLINE) ? env.int(OWNER_DEADLINE) : undefined,
        doors: true,
    }
}
