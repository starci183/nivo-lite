import { eachInOrder } from "@modules/platform/primitives"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { RecordEntity } from "../persistence/entities"
import { entityOf } from "./catalog-access.policy"
import type { EntityCatalog, InsertStamp } from "./compiler.contracts"
import { dataOf, defaultsOf, sequenceFieldsOf } from "./record-data.policy"
import { onlyRecord, RECORD_RETURNING, recordRowsOf } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"
import { nextSequenceValue } from "./sequence-next.policy"

/** One record to insert. */
export interface InsertInput {
    /** The entity name. */
    readonly entity: string
    /** The new record id (minted by the caller). */
    readonly id: string
    /** The declared fields to write; the workspace is never among them, sequence fields are minted here. */
    readonly values: Readonly<Record<string, unknown>>
    /** The time, ids and sequence functions of the runtime. */
    readonly stamp: InsertStamp
}

/**
 * Inserts one record into the scope's workspace: the declared defaults, then the given values (a jsonb value parsed by its shape),
 * then each sequence field's next counter value formatted. One `INSERT ... RETURNING` builder statement; a unique, check or
 * foreign-key violation surfaces as the database error the caller maps.
 */
export const insertRecord = async (tx: ScopedTx, catalog: EntityCatalog, input: InsertInput): Promise<RecordRow> => {
    const entity = entityOf(catalog, input.entity)
    const { stamp } = input
    const data: Record<string, unknown> = { ...defaultsOf(entity, stamp), ...dataOf(entity, input.values) }
    await eachInOrder(sequenceFieldsOf(entity), async ([name, field]) => {
        const next = await nextSequenceValue(tx, entity.name, name, stamp.sequences.period(field.resets, stamp.date))
        data[name] = stamp.sequences.format(field.format ?? "", next, stamp.date)
    })
    const result = await tx.manager
        .createQueryBuilder(RecordEntity, "r")
        .insert()
        .into(RecordEntity)
        .values({ id: input.id, workspaceId: tx.workspaceId, entity: entity.name, data: () => "CAST(:data AS jsonb)" })
        .setParameter("data", JSON.stringify(data))
        .returning(RECORD_RETURNING)
        .execute()
    return onlyRecord(recordRowsOf(result.raw))
}
