import { RecordEntity } from "../persistence/entities"
import type { RecordRow } from "./compiler.contracts"
import { recordRowOfEntity } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** One record of the scope's workspace by entity and id, or null when there is none (or it belongs to another workspace). */
export const getRecord = async (tx: ScopedTx, entity: string, id: string): Promise<RecordRow | null> => {
    const record = await tx.manager.findOne(RecordEntity, { where: { entity, id, workspaceId: tx.workspaceId } })
    return record === null ? null : recordRowOfEntity(record)
}
