import type { CustomKeyKind, EntityDefinition, FieldKind } from "@nivo-lite/agent-sdk/entity"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { ParamBag } from "./param-bag.policy"

/** The record columns every entity has; they are properties of the record entity, not keys of `data`. */
const SYSTEM_FIELDS: ReadonlySet<string> = new Set(["id", "workspaceId", "version", "createdAt", "updatedAt"])

/** The type a declared field is cast to when read out of `data` as text; null leaves the text as is. */
const CAST_OF_FIELD: Readonly<Record<FieldKind, string | null>> = {
    uuid: "uuid",
    text: null,
    int: "integer",
    bigint: "bigint",
    bool: "boolean",
    timestamptz: "timestamptz",
    date: "date",
    jsonb: null,
    enum: null,
    money_vnd: "bigint",
    sequence: null,
}

/** The type a nested jsonb key is cast to. */
const CAST_OF_KEY: Readonly<Record<CustomKeyKind, string | null>> = {
    text: null,
    int: "integer",
    bigint: "bigint",
    bool: "boolean",
    timestamptz: "timestamptz",
    date: "date",
    money_vnd: "bigint",
}

const unknownField = (entity: EntityDefinition, name: string): EntityEngineError =>
    new EntityEngineError({ code: EntityEngineErrorCode.FieldUnknown, params: { entity: entity.name, name } })

const cast = (expression: string, type: string | null): string =>
    type === null ? expression : `CAST(${expression} AS ${type})`

/**
 * The expression that reads a field of the record aliased `alias`: a system field is the column, a declared field is
 * `data ->> name` cast to its kind, and `<jsonbField>.<key>` is `data -> field ->> key` cast to the key's declared kind. The names
 * travel as bound parameters, so no identifier of the declaration is ever spliced into the text; the cast types and columns are
 * fixed words of this file.
 */
export const fieldExpression = (entity: EntityDefinition, name: string, alias: string, params: ParamBag): string => {
    if (SYSTEM_FIELDS.has(name)) return `${alias}.${name}`
    const dot = name.indexOf(".")
    const fieldName = dot === -1 ? name : name.slice(0, dot)
    const field = Object.hasOwn(entity.fields, fieldName) ? entity.fields[fieldName] : undefined
    if (field === undefined) throw unknownField(entity, name)
    const textOf = (value: string): string => `CAST(:${params.bind(value)} AS text)`
    if (dot === -1) return cast(`${alias}.data ->> ${textOf(fieldName)}`, CAST_OF_FIELD[field.kind])
    const key = name.slice(dot + 1)
    const keys = field.kind === "jsonb" ? field.keys : undefined
    const keyDef = keys !== undefined && Object.hasOwn(keys, key) ? keys[key] : undefined
    if (keyDef === undefined) throw unknownField(entity, name)
    return cast(`${alias}.data -> ${textOf(fieldName)} ->> ${textOf(key)}`, CAST_OF_KEY[keyDef.kind])
}
