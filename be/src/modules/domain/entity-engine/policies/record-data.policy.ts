import type { EntityDefinition, FieldDef, FieldDefault, FieldKind } from "@nivo-lite/agent-sdk/entity"
import type { Scalar } from "@nivo-lite/agent-sdk/query"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { InsertStamp } from "./compiler.contracts"

const invalidValue = (entity: EntityDefinition, name: string): EntityEngineError =>
    new EntityEngineError({ code: EntityEngineErrorCode.ValueInvalid, params: { entity: entity.name, name } })

/** The value to store for a declared field: a jsonb value passes through the field's declared shape, anything else is stored as given. */
const storedValue = (entity: EntityDefinition, name: string, field: FieldDef, value: unknown): unknown => {
    if (field.kind === "sequence") throw invalidValue(entity, name)
    if (field.kind !== "jsonb" || value === null) return value
    if (field.shape === undefined) throw invalidValue(entity, name)
    return field.shape.parse(value)
}

/**
 * The `data` object of the values a mutation writes: every key must be a declared, writable field (a system field, an unknown field
 * and a sequence field are refused), and a jsonb value is parsed by the shape its field declares.
 */
export const dataOf = (entity: EntityDefinition, values: Readonly<Record<string, unknown>>): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(values).map(([name, value]) => {
            const field = Object.hasOwn(entity.fields, name) ? entity.fields[name] : undefined
            if (field === undefined)
                throw new EntityEngineError({
                    code: EntityEngineErrorCode.FieldUnknown,
                    params: { entity: entity.name, name },
                })
            return [name, storedValue(entity, name, field, value)]
        }),
    )

const defaultOf = (declared: FieldDefault, kind: FieldKind, stamp: InsertStamp): unknown => {
    if (declared === "now") return stamp.now
    if (declared === "uuid") return stamp.newId()
    if (declared === "empty") return kind === "jsonb" ? {} : ""
    return declared.literal
}

/** The values an insert writes for the declared defaults of the fields (sequence fields are minted by the counter, not here). */
export const defaultsOf = (entity: EntityDefinition, stamp: InsertStamp): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(entity.fields).flatMap(([name, field]) =>
            field.default === undefined || field.kind === "sequence"
                ? []
                : [[name, defaultOf(field.default, field.kind, stamp)]],
        ),
    )

/** The sequence fields of an entity: the names and declarations the counter fills on insert. */
export const sequenceFieldsOf = (entity: EntityDefinition): ReadonlyArray<readonly [string, FieldDef]> =>
    Object.entries(entity.fields).filter(([, field]) => field.kind === "sequence")

/** A match value as a scalar (absent is null, which never matches); an object or list is not a key value. */
export const scalarOf = (entity: EntityDefinition, name: string, value: unknown): Scalar => {
    if (value === undefined || value === null) return null
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
    throw invalidValue(entity, name)
}
