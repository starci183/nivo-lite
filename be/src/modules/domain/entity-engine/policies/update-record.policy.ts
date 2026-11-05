import { RecordEntity } from "../persistence/entities"
import { entityOf } from "./catalog-access.policy"
import type { EntityCatalog, RecordRow } from "./compiler.contracts"
import { getRecord } from "./get-record.policy"
import { dataOf } from "./record-data.policy"
import { RECORD_RETURNING, recordRowsOf } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** One update of a record. */
export interface UpdateInput {
    /** The entity name. */
    readonly entity: string
    /** The record id. */
    readonly id: string
    /** The version the caller read; null updates whatever version the record has (inside a lock the caller holds). */
    readonly expected: string | null
    /** The declared fields to change; the others keep their value. */
    readonly patch: Readonly<Record<string, unknown>>
}

/** What an update did. */
export type UpdateOutcome =
    { readonly kind: "ok"; readonly row: RecordRow } | { readonly kind: "stale" } | { readonly kind: "missing" }

/**
 * One `UPDATE ... SET data = data || patch, version = version + 1 WHERE entity AND id AND workspace [AND version = expected]
 * RETURNING` builder statement; the record after the write, or null when no row matched.
 */
export const patchRecord = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    input: UpdateInput,
): Promise<RecordRow | null> => {
    const entity = entityOf(catalog, input.entity)
    const key = { entity: entity.name, id: input.id, workspaceId: tx.workspaceId }
    const result = await tx.manager
        .createQueryBuilder(RecordEntity, "r")
        .update(RecordEntity)
        .set({ data: () => "data || CAST(:patch AS jsonb)", version: () => "version + 1" })
        .where(input.expected === null ? key : { ...key, version: input.expected })
        .setParameter("patch", JSON.stringify(dataOf(entity, input.patch)))
        .returning(RECORD_RETURNING)
        .execute()
    const [row] = recordRowsOf(result.raw)
    return row ?? null
}

/** Updates a record at the version the caller read; when nothing matched, a read decides whether the version moved (stale) or the record is not there (missing). */
export const updateRecord = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    input: UpdateInput,
): Promise<UpdateOutcome> => {
    const row = await patchRecord(tx, catalog, input)
    if (row !== null) return { kind: "ok", row }
    return (await getRecord(tx, input.entity, input.id)) === null ? { kind: "missing" } : { kind: "stale" }
}
