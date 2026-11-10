import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { GraphNode, GraphNodeCard, GraphNodeStep, Say } from "../agent-graphs.contracts"

/** The longest line under a title: more would break the row of a top-to-bottom layered graph. */
export const CARD_LINE_MAX = 36

const TONE_OF_STEP: Readonly<Record<GraphNodeStep, GraphNodeCard["tone"]>> = {
    customer_message: "neutral",
    tag: "neutral",
    event: "neutral",
    schedule: "neutral",
    read_context: "accent",
    evaluate: "warning",
    call: "accent",
    reply: "success",
    approval: "warning",
    write: "success",
    stop: "muted",
}

/** `diamond` for a decision with labelled edges, `round` for a step a person answers, `rect` otherwise. No node is a bare terminal. */
const shapeOf = (node: GraphNode): GraphNodeCard["shape"] => {
    if (node.step === "evaluate") return "diamond"
    return node.doneBy === "person" || node.step === "approval" ? "round" : "rect"
}

/** The word of the rule behind a node: a branch the owner changed by hand reads "Self-corrected", else the kind of the first source. */
export const sourceWord = (node: GraphNode, say: Say): string => {
    const corrected = (node.decide?.branches ?? []).some((branch) => branch.selfCorrected === true)
    if (corrected) return say("agentGraphs.source.corrected")
    const [first] = node.sources
    return first === undefined ? "" : say(`agentGraphs.source.${first.kind}`)
}

const clipped = (text: string): string =>
    text.length > CARD_LINE_MAX ? `${text.slice(0, CARD_LINE_MAX - 1).trimEnd()}…` : text

/** One line of at most 36 characters built from what the node uses and who approves: "SePay · Dinh approves". */
export const cardLineOf = (node: GraphNode, approverName: string | null, say: Say): string => {
    const tools = node.uses.slice(0, 1).map((use) => use.label)
    const approver = approverName === null ? [] : [say("agentGraphs.card.approves", { name: approverName })]
    return clipped([...tools, ...approver].join(" · "))
}

/** A node as grammar draws it at a glance; selecting it opens all seven answers in the side pane. */
export const nodeCardOf = (node: GraphNode, approverName: string | null, say: Say): GraphNodeCard => ({
    id: node.key,
    label: node.title,
    description: cardLineOf(node, approverName, say),
    tone: TONE_OF_STEP[node.step],
    kind: node.kind,
    step: node.step,
    shape: shapeOf(node),
    count: sourceWord(node, say),
    isPlaceholder: node.uses.some((use) => use.placeholder === true),
})

/** The step a flow node reads as on a card: its route, its effect or its end. */
const flowStepOf = (node: GraphSpecNode): GraphNodeStep => {
    if (node.step === "stop") return "stop"
    if (node.kind === "trigger") return "tag"
    if (node.kind === "condition") return "evaluate"
    return node.kind === "execute" ? "call" : "write"
}

/** `diamond` for a route, `round` for a node that waits for someone, `rect` otherwise. */
const flowShapeOf = (node: GraphSpecNode, step: GraphNodeStep): GraphNodeCard["shape"] => {
    if (step === "evaluate") return "diamond"
    return node.wait === undefined ? "rect" : "round"
}

/**
 * A node of the graph's flow as grammar draws it: titled by its installed node (`title`), its id under it, the group (sub-flow) it
 * belongs to and what it waits for, so the owner sees the consult, the care and the waits in the graph view.
 */
export const flowNodeCardOf = (node: GraphSpecNode, title: string | null): GraphNodeCard => {
    const step = flowStepOf(node)
    return {
        id: node.key,
        label: title ?? node.key,
        description: clipped(node.step),
        tone: TONE_OF_STEP[step],
        kind: node.kind,
        step,
        shape: flowShapeOf(node, step),
        count: "",
        isPlaceholder: false,
        ...(node.group === undefined ? {} : { group: node.group }),
        ...(node.wait === undefined ? {} : { wait: { ...node.wait } }),
    }
}
