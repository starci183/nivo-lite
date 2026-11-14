import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { RecordEntity } from "../persistence/entities"
import { recordRowOfEntity } from "./record-row.policy"
import { agentKeyOf } from "./agent-scope.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/**
 * One record of the scope's workspace by entity and id, or null when there is none (or it belongs to another workspace, or, in a scope
 * confined to one agent, to another agent).
 */
export const getRecord = async (tx: ScopedTx, entity: string, id: string): Promise<RecordRow | null> => {
    const record = await tx.manager.findOne(RecordEntity, { where: { entity, id, workspaceId: tx.workspaceId, ...agentKeyOf(tx) } })
    return record === null ? null : recordRowOfEntity(record)
}
