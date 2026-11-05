import type { Scalar } from "@nivo-lite/agent-sdk/query"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { entityOf } from "./catalog-access.policy"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { EntityCatalog, InsertStamp } from "./compiler.contracts"
import { insertRecord } from "./insert-record.policy"
import { lockedLookup } from "./locked-lookup.policy"
import { scalarOf } from "./record-data.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** One find-or-create by a declared match key. */
export interface EnsureInput {
    /** The entity name. */
    readonly entity: string
    /** The name of the declared match key. */
    readonly match: string
    /** The values to insert when no record has the key's values. */
    readonly values: Readonly<Record<string, unknown>>
    /** The time, ids and sequence functions of the runtime. */
    readonly stamp: InsertStamp
}

/** The record an operation found or made, and whether it made it. */
export interface Ensured {
    /** The record. */
    readonly row: RecordRow
    /** True when the operation inserted it. */
    readonly created: boolean
}

/**
 * Find-or-create: under an advisory lock on (entity, workspace, key, values) it selects the record whose match-key fields equal the
 * given values and inserts one when there is none, so no unique index is needed on dirty data and two concurrent callers make one record.
 */
export const ensureRecord = async (tx: ScopedTx, catalog: EntityCatalog, input: EnsureInput): Promise<Ensured> => {
    const entity = entityOf(catalog, input.entity)
    const key = (entity.matchKeys ?? []).find((candidate) => candidate.name === input.match)
    if (key === undefined)
        throw new EntityEngineError({
            code: EntityEngineErrorCode.KeyUnknown,
            params: { entity: entity.name, name: input.match },
        })
    const fields = key.on.map((name): readonly [string, Scalar] => [name, scalarOf(entity, name, input.values[name])])
    const found = await lockedLookup(tx, catalog, entity, key.name, fields)
    if (found !== null) return { row: found, created: false }
    const row = await insertRecord(tx, catalog, {
        entity: entity.name,
        id: input.stamp.newId(),
        values: input.values,
        stamp: input.stamp,
    })
    return { row, created: true }
}
