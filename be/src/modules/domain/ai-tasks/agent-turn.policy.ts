import { turnEffortOf } from "@modules/integrations/ai"
import type { AiTasksOptions, NodeReasoning } from "./ai-tasks.options"

/** What a node asks of the model side for one run of its agent loop. */
export interface AgentTurnsAsk {
    /** `<node id>:<tag>`: the namespace of the node is the usage module. */
    readonly purpose: string
    /** The reasoning the node named for its own agent, when it named one. */
    readonly reasoning?: Exclude<NodeReasoning, "default"> | undefined
}

/**
 * The reasoning the turns of an agent run with: the node's own word, else the lane's effort for the weight blocks-core declares for
 * its step (`turnEffortOf`: a light step's short answer `low`, a heavy step's multi-step tool turn `medium`), else the app's setting
 * for node calls, else the model's default.
 */
export const agentReasoningOf = (
    options: Pick<AiTasksOptions, "nodeReasoning">,
    ask: AgentTurnsAsk,
    weight?: "light" | "heavy",
): NodeReasoning => ask.reasoning ?? (weight === undefined ? undefined : turnEffortOf(weight)) ?? options.nodeReasoning ?? "default"

/**
 * The tool choice of every request of an agent's step. Forcing a tool call on every turn (`required`) makes this model spend no
 * reasoning at all, so it is right only where the step asked for none: a step whose reasoning is off is forced to answer with a
 * tool, every other step is left free (`auto`) and a turn that answers with words instead of a tool is refused by the loop.
 */
export const agentToolChoiceOf = (reasoning: NodeReasoning): "auto" | "required" => (reasoning === "off" ? "required" : "auto")

/** How one agent turn is metered: its kind and the module namespace it is charged to. */
export interface AgentTurnMeta {
    /** The metering kind the turn is charged as. */
    readonly kind: string
    /** The module namespace the turn is charged to. */
    readonly module: string
}

/** How the turns of a node's agent are metered: engine work of the namespace its purpose starts with, like every call of the node. */
export const agentTurnMetaOf = (ask: AgentTurnsAsk): AgentTurnMeta => ({
    kind: "engine",
    module: ask.purpose.split(".", 1).join(""),
})
