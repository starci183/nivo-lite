import type { EntityManager } from "typeorm"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"

const [, , , , AgentGraphDecisionEntity] = agentGraphsEntities

/** What the graph decided about one work item: the branch it took, whether a person was asked, and whether it differed from the gate. */
export interface StoredDecision {
    readonly branchKey: string
    readonly outcome: string
    readonly shadowDiff: boolean
    readonly facts: Readonly<Record<string, string | number | boolean>>
}

/** The decisions the graph of an agent recorded for a work item. */
export const decisionsOf = async (manager: EntityManager, agentId: string, workItemId: string): Promise<Array<StoredDecision>> => {
    const rows = await manager.find(AgentGraphDecisionEntity, { where: { agentId, workItemId }, take: 5 })
    return rows.map((row) => ({ branchKey: row.branchKey, outcome: row.outcome, shadowDiff: row.shadowDiff, facts: row.facts }))
}
