import type { InjectionToken } from "@nestjs/common"
import type { AiOptions } from "@modules/integrations/ai"

/** The reasoning a node call asks for: none, an effort, or the model's own default. */
export type NodeReasoning = "off" | "low" | "medium" | "high" | "default"

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
