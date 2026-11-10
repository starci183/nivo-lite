import type { InjectionToken } from "@nestjs/common"
import type { AiOptions, AiRouting } from "@modules/integrations/ai"
import type { ConfiguredProviders } from "./ai-tasks.contracts"

/** The reasoning a node call asks for: none, an effort, or the model's own default. */
export type NodeReasoning = "off" | "minimal" | "low" | "medium" | "high" | "default"

/** The prompt library tunables, parsed once at boot. */
export interface AiTasksOptions {
    /** How long one prompt may take on the AI endpoint, in milliseconds. */
    readonly timeoutMs: number
    /**
     * How long one try of a graph node's call (an agent's turn, a decision, the engine's own) may take, in milliseconds; never above
     * `NODE_TIMEOUT_CEILING_MS`. Absent: the same as `timeoutMs`.
     */
    readonly nodeTimeoutMs?: number
    /**
     * How long a RETRY of a graph node's call may take, in milliseconds: shorter than the first try, since a model that did not
     * answer the first time is given less room the second and third, and the customer is waiting. Absent: the same as `timeoutMs`.
     */
    readonly nodeRetryTimeoutMs?: number
    /** The reasoning a graph node's call asks a reasoning model for; `default` (or absent) leaves the model's own. */
    readonly nodeReasoning?: NodeReasoning
    /**
     * The most completion tokens a graph node's call may produce, reasoning included (`max_tokens`). An effort is a share of this
     * limit at the endpoint, so without it "low" bounds nothing. Absent: no limit is sent. An answer cut at it is an AI failure
     * and is tried again, so it must leave room for the largest answer a step gives.
     */
    readonly nodeMaxTokens?: number
    /** The most tokens a graph node's call may spend on reasoning, as a direct cap, for a model that takes one. Absent: none is sent. */
    readonly nodeReasoningMaxTokens?: number
    /**
     * Which upstreams of the endpoint serve a graph node's call, and in what order (OpenRouter's `provider` object). Absent: nothing
     * is sent and the endpoint routes the call as it likes. A task never carries it.
     */
    readonly nodeRouting?: AiRouting
    /**
     * Which providers of the pool hold a key, for the model of a graph node's call. Absent: the upstream alone (no Anthropic key),
     * so the default model is the cheap one and an explicit Sonnet fails loudly.
     */
    readonly providers?: ConfiguredProviders
    /** The AI endpoint the app root registers the LangChain client with: the gateway of this deployment, or a provider. */
    readonly endpoint: AiOptions
}

/** What the prompt library needs at registration: its tunables and the providers of the doors it generates through. */
export interface AiTasksWiring extends AiTasksOptions {
    /** Provider of the `AiTaskRecall` port (the agent knowledge lens). */
    readonly recall: InjectionToken
    /** Provider of the `AiTaskMeter` port (the usage gate). */
    readonly meter: InjectionToken
}
