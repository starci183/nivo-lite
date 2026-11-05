import { returnedRows, rowShape } from "@modules/platform/database"
import { EntitySequenceEntity } from "../persistence/entities"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { ScopedTx } from "./scoped-tx.contracts"

const isCounter = rowShape({ value: "string" })

/**
 * The next counter value of one sequence field of the scope's workspace in one period: the counter row is created at 0 when it is
 * missing (`ON CONFLICT DO NOTHING`), then one `UPDATE ... RETURNING` increments it, so two transactions never get the same number
 * (the update waits on the row lock). The increment commits or rolls back with the caller's transaction.
 */
export const nextSequenceValue = async (
    tx: ScopedTx,
    entity: string,
    field: string,
    period: string,
): Promise<number> => {
    const key = { workspaceId: tx.workspaceId, entity, field, period }
    await tx.manager
        .createQueryBuilder(EntitySequenceEntity, "s")
        .insert()
        .into(EntitySequenceEntity)
        .values(key)
        .orIgnore()
        .execute()
    const result = await tx.manager
        .createQueryBuilder(EntitySequenceEntity, "s")
        .update(EntitySequenceEntity)
        .set({ value: () => "value + 1" })
        .where(key)
        .returning("value")
        .execute()
    const [counter] = returnedRows(result.raw, isCounter)
    if (counter === undefined) throw new EntityEngineError({ code: EntityEngineErrorCode.ResultMissing })
    return Number(counter.value)
}
