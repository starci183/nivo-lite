import { frameOfIntent } from "@modules/domain/intent-contracts"
import type { FrameAction, IntentTrigger } from "@modules/domain/intent-contracts"
import type { GraphDocument, GraphNodeStep, GraphProblem } from "../agent-graphs.contracts"
import { heldIntents, intentOfNode, reachableIntents } from "./intent-of-step.policy"

/** The triggers a contract runs under. */
const CONTRACT_TRIGGERS: ReadonlyArray<IntentTrigger> = ["customer_message", "tag"]

const triggerOf = (step: GraphNodeStep): IntentTrigger | null =>
    CONTRACT_TRIGGERS.find((trigger) => trigger === step) ?? null

const problem = (code: GraphProblem["code"], nodeKey: string, detail = ""): GraphProblem => ({
    code,
    nodeKey,
    branchKey: null,
    detail,
})

/**
 * What stops a graph from being published because no contract can be made of it: a node whose intent the catalogue has no frame for, and
 * a trigger that reaches no intent at all. Both are the code's to know, so the owner cannot publish past them.
 */
export const contractProblems = (
    graph: GraphDocument,
    actions: ReadonlyArray<FrameAction>,
): ReadonlyArray<GraphProblem> => [
    ...graph.nodes.flatMap((node) => {
        const intent = intentOfNode(node)
        return intent !== null && frameOfIntent(intent, actions, "tag") === null
            ? [problem("intent_no_frame", node.key, intent)]
            : []
    }),
    ...graph.nodes.flatMap((node) => {
        const trigger = node.kind === "trigger" ? triggerOf(node.step) : null
        return trigger !== null && reachableIntents(graph, trigger).length === 0
            ? [problem("trigger_no_intent", node.key)]
            : []
    }),
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
