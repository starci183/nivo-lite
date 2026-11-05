import type { UniqueConstraint } from "@nivo-lite/agent-sdk/entity"
import type { Scalar } from "@nivo-lite/agent-sdk/query"
import { entityOf } from "./catalog-access.policy"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { EntityCatalog, InsertStamp } from "./compiler.contracts"
import type { Ensured } from "./ensure-record.policy"
import { insertRecord } from "./insert-record.policy"
import { lockedLookup } from "./locked-lookup.policy"
import { scalarOf } from "./record-data.policy"
import type { ScopedTx } from "./scoped-tx.contracts"
import { patchRecord } from "./update-record.policy"

/** One insert-or-update on a declared unique constraint. */
export interface UpsertInput {
    /** The entity name. */
    readonly entity: string
    /** The name of the declared unique constraint. */
    readonly constraint: string
    /** The values to write: inserted as a new record, or merged into the record the constraint's fields name. */
    readonly values: Readonly<Record<string, unknown>>
    /** The time, ids and sequence functions of the runtime. */
    readonly stamp: InsertStamp
}

/**
 * Upsert on a declared unique constraint: under the same advisory lock as `ensureRecord` it finds the record the constraint's fields
 * name and patches it (version bumped), else inserts. An insert that still races a writer outside the lock hits the unique index
 * itself and surfaces as the database error the caller maps to `taken`.
 */
export const upsertRecord = async (tx: ScopedTx, catalog: EntityCatalog, input: UpsertInput): Promise<Ensured> => {
    const entity = entityOf(catalog, input.entity)
    const unique = (entity.constraints ?? []).find(
        (candidate): candidate is UniqueConstraint =>
            candidate.kind === "unique" && candidate.name === input.constraint,
    )
    if (unique === undefined)
        throw new EntityEngineError({
            code: EntityEngineErrorCode.KeyUnknown,
            params: { entity: entity.name, name: input.constraint },
        })
    const fields = unique.on.map((name): readonly [string, Scalar] => [
        name,
        scalarOf(entity, name, input.values[name]),
    ])
    const found = await lockedLookup(tx, catalog, entity, unique.name, fields)
    const patched =
        found === null
            ? null
            : await patchRecord(tx, catalog, { entity: entity.name, id: found.id, expected: null, patch: input.values })
    if (patched !== null) return { row: patched, created: false }
    const row = await insertRecord(tx, catalog, {
        entity: entity.name,
        id: input.stamp.newId(),
        values: input.values,
        stamp: input.stamp,
    })
    return { row, created: true }
}
