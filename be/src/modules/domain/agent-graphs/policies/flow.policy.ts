import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { GraphDocument } from "../agent-graphs.contracts"

/** The text of a value with the keys of every object in order: the database keeps a document with its keys in its own order, so equal content must compare equal. */
const canonicalText = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalText).join(",")}]`
    if (value === null || typeof value !== "object") return String(JSON.stringify(value))
    const entries = Object.entries(value)
        .filter(([, member]) => member !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : 1))
    return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonicalText(member)}`).join(",")}}`
}

/** True when a graph already runs this flow, whatever the order of the keys of either. */
export const sameFlow = (held: GraphSpec | undefined, wanted: GraphSpec): boolean =>
    held !== undefined && canonicalText(held) === canonicalText(wanted)

/** True for a graph that holds a flow and none of the old nodes: the flow runs the agent, so the old walk has nothing to judge and must not answer for it. */
export const isFlowOnly = (document: GraphDocument): boolean => document.flow !== undefined && document.nodes.length === 0
