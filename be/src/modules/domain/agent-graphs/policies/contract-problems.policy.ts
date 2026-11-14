import type { GraphDocument, GraphProblem } from "../agent-graphs.contracts"
import { heldIntents } from "./intent-of-step.policy"

const problem = (code: GraphProblem["code"], nodeKey: string, detail = ""): GraphProblem => ({
    code,
    nodeKey,
    branchKey: null,
    detail,
})

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
