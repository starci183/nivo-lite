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

/** The intent that answers a customer when the owner drew a reply and named no action. */
const REPLY_INTENT = "reply_customer"

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
    reply: (node) => node.action ?? REPLY_INTENT,
    approval: none,
    write: actionOf,
    stop: none,
}

/** The intent a node yields, or null. */
export const intentOfNode = (node: GraphNode): string | null => INTENT_OF_STEP[node.step](node)

/** Every intent the graph holds, reachable or not, in the order the nodes are listed. */
export const heldIntents = (document: GraphDocument): ReadonlyArray<string> =>
    document.nodes.flatMap((node) => intentOfNode(node) ?? [])

/**
 * The intents a trigger reaches: walk forward from the trigger nodes of that step through every edge and every branch, and collect what
 * the nodes yield, once each, in the order they are met.
 */
export const reachableIntents = (document: GraphDocument, trigger: IntentTrigger): ReadonlyArray<ReachedIntent> => {
    const byKey = new Map(document.nodes.map((node) => [node.key, node]))
    const queue = document.nodes
        .filter((node) => node.kind === "trigger" && node.step === trigger)
        .map((node) => node.key)
    const seen = new Set<string>()
    const found = new Map<string, string>()
    for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        const node = byKey.get(key)
        if (node !== undefined && !seen.has(key)) {
            seen.add(key)
            const intent = intentOfNode(node)
            if (intent !== null && !found.has(intent)) found.set(intent, node.title)
            queue.push(...successorsOf(node))
        }
    }
    return [...found].map(([intent, label]) => ({ intent, label }))
}
