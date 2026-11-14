import { fileRefsOf, type ContactDeleteRule, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { FilterExpr, Scalar } from "@nivo-lite/agent-sdk/query"

/** The contact fields of a type, with their declarations. */
export const contactFieldsOf = (entity: EntityDefinition): ReadonlyArray<readonly [string, FieldDef]> =>
    Object.entries(entity.fields).filter(([, field]) => field.kind === "contact")

/** What deleting a contact does to a record through this field: its declared rule, `erase` when none. */
export const contactRuleOf = (field: FieldDef): ContactDeleteRule => field.onContactDelete ?? "erase"

const isContactField = (entity: EntityDefinition, name: string): boolean =>
    Object.hasOwn(entity.fields, name) && entity.fields[name]?.kind === "contact"

/** The value a write gives a field, when it names it. */
const valueOf = (values: Readonly<Record<string, unknown>>, name: string): unknown =>
    Object.hasOwn(values, name) ? values[name] : undefined

/** The contact ids a write names (each non-null value of a contact field), in field order. */
export const contactIdsOf = (entity: EntityDefinition, values: Readonly<Record<string, unknown>>): ReadonlyArray<string> =>
    contactFieldsOf(entity).flatMap(([name]) => {
        const value = valueOf(values, name)
        return typeof value === "string" ? [value] : []
    })

/** The contact fields of a write with the id each contact stands for now, or the first field whose contact the workspace does not hold. */
export type CurrentContacts =
    | { readonly ok: true; readonly contacts: Readonly<Record<string, string>> }
    | { readonly ok: false; readonly field: string }

/**
 * The write the engine stores: each contact field holds the id its contact stands for NOW (the survivor of a merge), as `current`
 * (from the contacts port: every held, active contact id to its current id) answers; a contact the workspace does not hold (unknown,
 * erased, another workspace's) refuses the write at that field.
 */
export const withCurrentContacts = (
    entity: EntityDefinition,
    values: Readonly<Record<string, unknown>>,
    current: ReadonlyMap<string, string>,
): CurrentContacts => {
    const contacts: Record<string, string> = {}
    for (const [name] of contactFieldsOf(entity)) {
        const value = valueOf(values, name)
        if (typeof value !== "string") continue
        const now = current.get(value)
        if (now === undefined) return { ok: false, field: name }
        contacts[name] = now
    }
    return { ok: true, contacts }
}

const textsOf = (values: ReadonlyArray<Scalar>): ReadonlyArray<string> =>
    values.flatMap((value) => (typeof value === "string" ? [value] : []))

/** The contact ids a filter compares a contact field with (`eq`, `in`), in tree order: what the read asks the contacts' aliases of. */
export const contactFilterValuesOf = (entity: EntityDefinition, filter: FilterExpr): ReadonlyArray<string> => {
    switch (filter.op) {
        case "and":
        case "or":
            return filter.of.flatMap((part) => contactFilterValuesOf(entity, part))
        case "not":
            return contactFilterValuesOf(entity, filter.of)
        case "eq":
            return isContactField(entity, filter.field) && typeof filter.value === "string" ? [filter.value] : []
        case "in":
            return isContactField(entity, filter.field) ? textsOf(filter.values) : []
        case "gt":
        case "gte":
        case "has":
        case "isNull":
        case "lt":
        case "lte":
        case "ne":
        case "notIn":
        case "notNull":
        case "overlaps":
        case "search":
            return []
    }
}

/**
 * The filter with every comparison of a contact field widened to the ids merged into that contact (`aliases`: an id to itself and every
 * id merged into it): records keep the id they were written with, and a merge is followed at read time through the contacts' ONE
 * redirect, never by rewriting rows. Other parts of the tree, and a `has` into another type, are kept as they are.
 */
export const contactFilterOf = (
    entity: EntityDefinition,
    filter: FilterExpr,
    aliases: ReadonlyMap<string, ReadonlyArray<string>>,
): FilterExpr => {
    const widened = (ids: ReadonlyArray<string>): ReadonlyArray<string> => [
        ...new Set(ids.flatMap((id) => aliases.get(id) ?? [id])),
    ]
    switch (filter.op) {
        case "and":
        case "or":
            return { ...filter, of: filter.of.map((part) => contactFilterOf(entity, part, aliases)) }
        case "not":
            return { ...filter, of: contactFilterOf(entity, filter.of, aliases) }
        case "eq":
            return isContactField(entity, filter.field) && typeof filter.value === "string"
                ? { op: "in", field: filter.field, values: widened([filter.value]) }
                : filter
        case "in":
            return isContactField(entity, filter.field) ? { ...filter, values: widened(textsOf(filter.values)) } : filter
        case "gt":
        case "gte":
        case "has":
        case "isNull":
        case "lt":
        case "lte":
        case "ne":
        case "notIn":
        case "notNull":
        case "overlaps":
        case "search":
            return filter
    }
}

/** The object keys of the files a record holds (every reference of each file field): what is removed from the store once the record is erased. */
export const filesOf = (entity: EntityDefinition, data: Readonly<Record<string, unknown>>): ReadonlyArray<string> =>
    Object.entries(entity.fields).flatMap(([name, field]) => {
        if (field.kind !== "file") return []
        return fileRefsOf(field, valueOf(data, name)).map((ref) => ref.key)
    })
