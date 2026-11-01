import type { GraphDocument, GraphProblem } from "../agent-graphs.contracts"
import { eventTypesOf, heldIntents, intentOfNode, intentsFrom } from "./intent-of-step.policy"

const problem = (code: GraphProblem["code"], nodeKey: string, detail = ""): GraphProblem => ({
    code,
    nodeKey,
    branchKey: null,
    detail,
})

/**
 * What stops a graph from being published because no contract can be made of it: a node whose intent has no frame, and a trigger that
 * matches events and reaches no intent at all. Both are the code's to know, so the owner cannot publish past them.
 */
export const contractProblems = (
    graph: GraphDocument,
    hasFrame: (intent: string) => boolean,
): ReadonlyArray<GraphProblem> => [
    ...graph.nodes.flatMap((node) => {
        const intent = intentOfNode(node)
        return intent !== null && !hasFrame(intent) ? [problem("intent_no_frame", node.key, intent)] : []
    }),
    ...graph.nodes.flatMap((node) =>
        eventTypesOf(node).length > 0 && intentsFrom(graph, [node.key]).length === 0
            ? [problem("trigger_no_intent", node.key)]
            : [],
    ),
]

/**
 * What only warns, because shipped graphs hold no contracts and a rollback must still publish: a contract for an intent the graph does
 * not hold, and a contract that states no task of the shop.
 */
export const contractWarnings = (graph: GraphDocument): ReadonlyArray<GraphProblem> => {
    const held = new Set(heldIntents(graph))
    return (graph.contracts ?? []).flatMap((contract) => [
        ...(held.has(contract.intent) ? [] : [problem("contract_unknown_intent", "", contract.intent)]),
        ...(contract.task.trim() === "" ? [problem("contract_no_task", "", contract.intent)] : []),
    ])
}
