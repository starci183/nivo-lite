import type { EnvSource } from "@modules/platform/config"
import type { AiOptions } from "@modules/integrations/ai"
import type { AiTasksOptions, NodeReasoning } from "./ai-tasks.options"
import { NODE_TIMEOUT_CEILING_MS } from "./call-limits.policy"

const TIMEOUT_DEFAULT_MS = 45_000
/** One try of a node call: an agent's turn reads a prompt of thousands of tokens, which a 45 s deadline cut while the model was still answering. */
const NODE_TIMEOUT_DEFAULT_MS = 90_000
/** A retry of a node call: half the first try, so three tries end within three minutes (90 s, then 45 s twice). */
const NODE_RETRY_TIMEOUT_DEFAULT_MS = 45_000
/** A node call answers a small JSON object: a low effort keeps a reasoning model from spending its whole answer on thinking. */
const NODE_REASONING_DEFAULT: NodeReasoning = "low"
const NODE_REASONINGS: ReadonlyArray<NodeReasoning> = ["off", "low", "medium", "high", "default"]

/** The reasoning setting of node calls: one of the known values, the default for anything else. */
const nodeReasoningOf = (declared: string | undefined): NodeReasoning =>
    NODE_REASONINGS.find((known) => known === declared?.trim().toLowerCase()) ?? NODE_REASONING_DEFAULT

/**
 * Reads the prompt library tunables: `AI_TIMEOUT` (one try of a task), `AI_NODE_TIMEOUT` (the first try of a graph node's call) and
 * `AI_NODE_RETRY_TIMEOUT` (each retry of it), both capped at the ceiling, and `AI_NODE_REASONING` (`off`, `low`, `medium`, `high` or `default`: what a node call asks a reasoning model for); there is no secret here, the key belongs to the LangChain integration, whose settings ride along as the endpoint. */
export const parseAiTasksConfig = (env: EnvSource, endpoint: AiOptions): AiTasksOptions => ({
    endpoint,
    timeoutMs: env.duration("AI_TIMEOUT", TIMEOUT_DEFAULT_MS),
    nodeTimeoutMs: Math.min(env.duration("AI_NODE_TIMEOUT", NODE_TIMEOUT_DEFAULT_MS), NODE_TIMEOUT_CEILING_MS),
    nodeRetryTimeoutMs: Math.min(
        env.duration("AI_NODE_RETRY_TIMEOUT", NODE_RETRY_TIMEOUT_DEFAULT_MS),
        NODE_TIMEOUT_CEILING_MS,
    ),
    nodeReasoning: nodeReasoningOf(env.optional("AI_NODE_REASONING")),
})
