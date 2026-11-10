import type { AiBudget, AiRouting } from "@modules/integrations/ai"
import type { AiTasksOptions, NodeReasoning } from "./ai-tasks.options"

/** The kinds of model call the prompt library makes: a fixed-shape task of the app, or a call of a graph node (a step's agent turn, a decision, the engine's own). */
export type CallKind = "task" | "node"

/**
 * The longest one try of a node call may be given, in milliseconds. A call that gets no answer is made once more, so a node call
 * holds its step for at most twice this: four minutes, well inside the ten minutes the heartbeat of a running turn renews its lease for.
 */
export const NODE_TIMEOUT_CEILING_MS = 120_000

/** What one try of a call is bounded by: how long it may take, and what a reasoning model may spend on it (absent: the model's own default). */
export interface CallLimits {
    /** The whole try, in milliseconds. */
    readonly timeoutMs: number
    /** The reasoning the model is asked for; absent leaves the model's default. */
    readonly budget?: AiBudget
    /** Which upstreams may serve the try; absent sends nothing. */
    readonly routing?: AiRouting
}

/** The caps of node calls an app may set: the output limit and the direct cap on reasoning. */
type NodeCaps = Pick<AiTasksOptions, "nodeMaxTokens" | "nodeReasoningMaxTokens">

/**
 * What a node call may spend, or nothing when the setting leaves the model's own default: the effort, with the output limit and
 * the direct reasoning cap when the app set them. A call whose reasoning is off needs no reasoning cap, and keeps the output limit.
 */
const budgetOf = (reasoning: NodeReasoning, caps: NodeCaps): Pick<CallLimits, "budget"> =>
    reasoning === "default"
        ? {}
        : {
              budget: {
                  effort: reasoning,
                  ...(caps.nodeMaxTokens === undefined ? {} : { maxTokens: caps.nodeMaxTokens }),
                  ...(caps.nodeReasoningMaxTokens === undefined || reasoning === "off"
                      ? {}
                      : { reasoningMaxTokens: caps.nodeReasoningMaxTokens }),
              },
          }

/**
 * The routing of one try of a node call, or nothing when the app set none. A retry starts the order one upstream later (the second
 * try at the second, the third at the third, wrapping): the try before it got no answer from the upstream that heads its order, and
 * a retry that asks the same one first waits on the same queue. It changes which upstream is asked first, never how many tries
 * there are. An order of one upstream, or a routing without an order, is the same on every try.
 */
const routingOf = (routing: AiRouting | undefined, tryNumber: number): Pick<CallLimits, "routing"> => {
    if (routing === undefined) return {}
    const order = routing.order ?? []
    if (order.length < 2 || tryNumber <= 1) return { routing }
    const start = (tryNumber - 1) % order.length
    return { routing: { ...routing, order: [...order.slice(start), ...order.slice(0, start)] } }
}

/**
 * The limits of a call by its kind. A task keeps the library's deadline and the model's default. A node call reads a prompt of
 * thousands of tokens and answers a small JSON object: left alone, a reasoning model spends most of its answer on thinking nobody
 * reads, so its reasoning is bounded and its deadline is its own, never above the ceiling.
 */
/**
 * `asked` is the reasoning a node named for its own call, when it named one. `tryNumber` is which try of the call this is, from
 * one: a node call's first try gets its full deadline, each retry the shorter one; a task keeps the same deadline on every try.
 */
export const callLimitsOf = (
    options: Pick<
        AiTasksOptions,
        | "timeoutMs"
        | "nodeTimeoutMs"
        | "nodeRetryTimeoutMs"
        | "nodeReasoning"
        | "nodeMaxTokens"
        | "nodeReasoningMaxTokens"
        | "nodeRouting"
    >,
    kind: CallKind,
    asked?: Exclude<NodeReasoning, "default">,
    tryNumber = 1,
): CallLimits =>
    kind === "task"
        ? { timeoutMs: options.timeoutMs }
        : {
              timeoutMs: Math.min(
                  tryNumber <= 1
                      ? (options.nodeTimeoutMs ?? options.timeoutMs)
                      : (options.nodeRetryTimeoutMs ?? options.timeoutMs),
                  NODE_TIMEOUT_CEILING_MS,
              ),
              // The node's own word wins over the default of node calls: its author knows what the call weighs.
              ...budgetOf(asked ?? options.nodeReasoning ?? "default", options),
              ...routingOf(options.nodeRouting, tryNumber),
          }
