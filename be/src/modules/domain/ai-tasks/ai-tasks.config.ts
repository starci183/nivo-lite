import type { EnvSource } from "@modules/platform/config"
import type { AiOptions, AiRouting } from "@modules/integrations/ai"
import type { ConfiguredProviders } from "./ai-tasks.contracts"
import type { AiTasksOptions, NodeReasoning } from "./ai-tasks.options"
import { NODE_TIMEOUT_CEILING_MS } from "./call-limits.policy"

const TIMEOUT_DEFAULT_MS = 45_000
/** One try of a node call: an agent's turn reads a prompt of thousands of tokens, which a 45 s deadline cut while the model was still answering. */
const NODE_TIMEOUT_DEFAULT_MS = 90_000
/** A retry of a node call: half the first try, so three tries end within three minutes (90 s, then 45 s twice). */
const NODE_RETRY_TIMEOUT_DEFAULT_MS = 45_000
/** A node call answers a small JSON object: a low effort keeps a reasoning model from spending its whole answer on thinking. */
const NODE_REASONING_DEFAULT: NodeReasoning = "low"
const NODE_REASONINGS: ReadonlyArray<NodeReasoning> = ["off", "minimal", "low", "medium", "high", "default"]

/** A declared cap: its number, or nothing. */
interface DeclaredCap {
    readonly value?: number
}

/** A positive whole number the environment declares, or nothing: a cap that is absent, zero or malformed is not sent. */
const capOf = (declared: string | undefined): DeclaredCap => {
    const value = Number(declared)
    return declared !== undefined && Number.isInteger(value) && value > 0 ? { value } : {}
}

/** The two caps of node calls, each only when the environment declares it. */
const nodeCapsOf = (env: EnvSource): Pick<AiTasksOptions, "nodeMaxTokens" | "nodeReasoningMaxTokens"> => {
    const output = capOf(env.optional("AI_NODE_MAX_TOKENS")).value
    const reasoning = capOf(env.optional("AI_NODE_REASONING_MAX_TOKENS")).value
    return {
        ...(output === undefined ? {} : { nodeMaxTokens: output }),
        ...(reasoning === undefined ? {} : { nodeReasoningMaxTokens: reasoning }),
    }
}

const SORTS: ReadonlyArray<NonNullable<AiRouting["sort"]>> = ["price", "throughput", "latency"]

/** The upstream slugs a comma-separated value names, lower case, in order, each once; none for an absent or empty value. */
const slugsOf = (declared: string | undefined): Array<string> => [
    ...new Set(
        (declared ?? "")
            .split(",")
            .map((slug) => slug.trim().toLowerCase())
            .filter((slug) => slug !== ""),
    ),
]

/** True or false as the environment spells it; nothing for an absent or any other value. */
const flagOf = (declared: string | undefined): boolean | undefined => {
    const value = declared?.trim().toLowerCase()
    if (value === "true" || value === "1") return true
    return value === "false" || value === "0" ? false : undefined
}

/**
 * The routing of node calls, only when the environment declares one: without `AI_NODE_PROVIDER_ORDER`, `AI_NODE_PROVIDER_ONLY`
 * and `AI_NODE_PROVIDER_SORT` there is none and no `provider` field is sent. `AI_NODE_ALLOW_FALLBACKS` alone routes nothing, so it
 * is read only beside one of them.
 */
const nodeRoutingOf = (env: EnvSource): Pick<AiTasksOptions, "nodeRouting"> => {
    const order = slugsOf(env.optional("AI_NODE_PROVIDER_ORDER"))
    const only = slugsOf(env.optional("AI_NODE_PROVIDER_ONLY"))
    const sort = SORTS.find((known) => known === env.optional("AI_NODE_PROVIDER_SORT")?.trim().toLowerCase())
    if (order.length === 0 && only.length === 0 && sort === undefined) return {}
    const allowFallbacks = flagOf(env.optional("AI_NODE_ALLOW_FALLBACKS"))
    return {
        nodeRouting: {
            ...(order.length === 0 ? {} : { order }),
            ...(only.length === 0 ? {} : { only }),
            ...(sort === undefined ? {} : { sort }),
            ...(allowFallbacks === undefined ? {} : { allowFallbacks }),
        },
    }
}

/** The reasoning setting of node calls: one of the known values, the default for anything else. */
const nodeReasoningOf = (declared: string | undefined): NodeReasoning =>
    NODE_REASONINGS.find((known) => known === declared?.trim().toLowerCase()) ?? NODE_REASONING_DEFAULT

/**
 * Which providers of the pool serve chat, by the same variables the gateway pools them from (`integrations/ai-gateway`): Anthropic by
 * `ANTHROPIC_API_KEY` serves every chat profile (owner 2026-11-11: no more OpenRouter); OpenRouter serves no chat any more,
 * so it is never configured here (its key may stay sealed for embeddings). Only presence is read.
 */
const configuredProvidersOf = (env: EnvSource): ConfiguredProviders => ({
    anthropic: env.has("ANTHROPIC_API_KEY"),
    openrouter: false,
})

/**
 * Reads the prompt library tunables: `AI_TIMEOUT` (one try of a task), `AI_NODE_TIMEOUT` (the first try of a graph node's call) and
 * `AI_NODE_RETRY_TIMEOUT` (each retry of it), both capped at the ceiling, and `AI_NODE_REASONING` (`off`, `minimal`, `low`, `medium`, `high` or `default`: what a node call asks a reasoning model for),
 * `AI_NODE_MAX_TOKENS` (the output limit of a node call, reasoning included) and `AI_NODE_REASONING_MAX_TOKENS` (a direct cap on its
 * reasoning), neither sent unless declared, and the routing of node calls over the endpoint's upstreams, none sent unless declared
 * (INERT since every chat profile is Claude: the `provider` field rides only with OpenRouter's fields, which no call sends now):
 * `AI_NODE_PROVIDER_ORDER` (comma-separated upstream slugs, tried first to last; a retry starts one later), `AI_NODE_PROVIDER_ONLY`
 * (the only upstreams allowed), `AI_NODE_PROVIDER_SORT` (`price`, `throughput` or `latency`) and `AI_NODE_ALLOW_FALLBACKS` (`false`
 * refuses every other upstream); there is no secret here, the key belongs to the LangChain integration, whose settings ride along as the endpoint. */
export const parseAiTasksConfig = (env: EnvSource, endpoint: AiOptions): AiTasksOptions => ({
    endpoint,
    timeoutMs: env.duration("AI_TIMEOUT", TIMEOUT_DEFAULT_MS),
    nodeTimeoutMs: Math.min(env.duration("AI_NODE_TIMEOUT", NODE_TIMEOUT_DEFAULT_MS), NODE_TIMEOUT_CEILING_MS),
    nodeRetryTimeoutMs: Math.min(
        env.duration("AI_NODE_RETRY_TIMEOUT", NODE_RETRY_TIMEOUT_DEFAULT_MS),
        NODE_TIMEOUT_CEILING_MS,
    ),
    nodeReasoning: nodeReasoningOf(env.optional("AI_NODE_REASONING")),
    ...nodeCapsOf(env),
    ...nodeRoutingOf(env),
    providers: configuredProvidersOf(env),
})
