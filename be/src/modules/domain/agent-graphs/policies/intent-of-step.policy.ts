import type { IntentTrigger } from "@modules/domain/intent-contracts"
import type { GraphDocument, GraphNode, GraphNodeStep } from "../agent-graphs.contracts"
import { successorsOf } from "./graph-successors.policy"

/** How a node yields an intent: the key of the intent it stands for, or null when it yields none. */
type IntentOfNode = (node: GraphNode) => string | null

/** One intent a trigger reaches, with the title the owner gave the node that yields it. */
export interface ReachedIntent {
    /** The intent, an authority action key. */
    readonly intent: string
    /** The title of the node. */
    readonly label: string
}

const none: IntentOfNode = () => null

const actionOf: IntentOfNode = (node) => node.action ?? null

/**
 * How each step yields an intent. A node type that is added to the graph is one more entry here, because the table is typed over every
 * step; the pipeline only ever sees the intents, never the step.
 */
export const INTENT_OF_STEP: Readonly<Record<GraphNodeStep, IntentOfNode>> = {
    customer_message: none,
    tag: none,
    event: none,
    schedule: none,
    read_context: none,
    evaluate: none,
    call: actionOf,
    reply: actionOf,
    approval: none,
    write: actionOf,
    stop: none,
}

/** The event types each trigger step stands for when its node names none, so a graph shipped before triggers could match keeps its meaning. */
export const EVENT_TYPES_OF_STEP: Readonly<Partial<Record<GraphNodeStep, ReadonlyArray<string>>>> = {
    customer_message: ["customer_message"],
    tag: ["tag"],
}

/** The intent a node yields, or null. */
export const intentOfNode = (node: GraphNode): string | null => INTENT_OF_STEP[node.step](node)

/** Every intent the graph holds, reachable or not, in the order the nodes are listed. */
export const heldIntents = (document: GraphDocument): ReadonlyArray<string> =>
    document.nodes.flatMap((node) => intentOfNode(node) ?? [])

/** The event types a trigger node matches: those it names, else those its step stands for. */
export const eventTypesOf = (node: GraphNode): ReadonlyArray<string> =>
    node.kind === "trigger" ? (node.trigger?.eventTypes ?? EVENT_TYPES_OF_STEP[node.step] ?? []) : []

/** True when the trigger node matches an event of that type from that source (null: the source is not known). */
const matches = (node: GraphNode, eventType: IntentTrigger, source: string | null): boolean => {
    const sources = node.trigger?.sources ?? []
    const heard = sources.length === 0 || (source !== null && sources.includes(source))
    return eventTypesOf(node).includes(eventType) && heard
}

const startsFor = (document: GraphDocument, eventType: IntentTrigger, source: string | null): ReadonlyArray<string> =>
    document.nodes.filter((node) => matches(node, eventType, source)).map((node) => node.key)

/** The nodes reached through every edge and branch, once each, in traversal order. */
const nodesFrom = (document: GraphDocument, starts: ReadonlyArray<string>): ReadonlyArray<GraphNode> => {
    const byKey = new Map(document.nodes.map((node) => [node.key, node]))
    const queue = [...starts]
    const seen = new Set<string>()
    const found: Array<GraphNode> = []
    for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        const node = byKey.get(key)
        if (node !== undefined && !seen.has(key)) {
            seen.add(key)
            found.push(node)
            queue.push(...successorsOf(node))
        }
    }
    return found
}

/** The intents reached by walking forward from the nodes, through every edge and every branch, once each, in the order they are met. */
export const intentsFrom = (document: GraphDocument, starts: ReadonlyArray<string>): ReadonlyArray<ReachedIntent> => {
    const found = new Map<string, string>()
    for (const node of nodesFrom(document, starts)) {
        const intent = intentOfNode(node)
        if (intent !== null && !found.has(intent)) found.set(intent, node.title)
    }
    return [...found].map(([intent, label]) => ({ intent, label }))
}

/** The published path a trigger can reach from its actual adapter source, including its output nodes. */
export const nodesForTrigger = (
    document: GraphDocument,
    eventType: IntentTrigger,
    source: string | null = null,
): ReadonlyArray<GraphNode> => nodesFrom(document, startsFor(document, eventType, source))

/** The intents an event reaches: walk forward from the trigger nodes that match its type and its source. */
export const reachableIntents = (
    document: GraphDocument,
    eventType: IntentTrigger,
    source: string | null = null,
): ReadonlyArray<ReachedIntent> => intentsFrom(document, startsFor(document, eventType, source))
