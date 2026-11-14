import type { GraphDocument, GraphNode, GraphNodeStep } from "../agent-graphs.contracts"

/** How a node yields an intent: the key of the intent it stands for, or null when it yields none. */
type IntentOfNode = (node: GraphNode) => string | null

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

/** The intent a node yields, or null. */
export const intentOfNode = (node: GraphNode): string | null => INTENT_OF_STEP[node.step](node)

/** Every intent the graph holds, reachable or not, in the order the nodes are listed. */
export const heldIntents = (document: GraphDocument): ReadonlyArray<string> =>
    document.nodes.flatMap((node) => intentOfNode(node) ?? [])
