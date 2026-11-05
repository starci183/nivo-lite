import type { CustomKeyDef, EntityDefinition, FieldKind } from "../entity/entity.types"
import { ownEntry } from "./own"
import type { QueryProblemCode } from "./query.types"

/** Where a field is used: a custom key must be declared `filter` to be filtered on and `sort` to be sorted on. */
export type FieldUse = "select" | "where" | "order" | "group"

/** A field as a tree sees it: its kind, whether a row may hold null for it, and whether it is a custom (jsonb) key. */
export interface ResolvedField {
    /** The kind the value is compared as. */
    readonly kind: FieldKind
    /** Whether a row may hold null (or no key) for it. */
    readonly nullable: boolean
    /** Whether it is a nested key of a jsonb field. */
    readonly custom: boolean
}

/** The result of resolving a field name: the field, or the problem code that says why not. */
export type FieldResolution =
    { readonly ok: true; readonly field: ResolvedField } | { readonly ok: false; readonly code: QueryProblemCode }

/** The comparison family of a kind: a value, a ref or a range end must be of the family of the field it meets. */
export type KindClass = "number" | "text" | "bool" | "time" | "date" | "uuid" | "json"

const CLASS_OF: Readonly<Record<FieldKind, KindClass>> = {
    uuid: "uuid",
    text: "text",
    int: "number",
    bigint: "number",
    bool: "bool",
    timestamptz: "time",
    date: "date",
    jsonb: "json",
    enum: "text",
    money_vnd: "number",
    sequence: "text",
}

/** The families a value can be ordered in (lt, gt, min, max, sort). */
export const ORDERED_CLASSES: ReadonlySet<KindClass> = new Set<KindClass>(["number", "text", "time", "date"])

/** The comparison family of a field kind. */
export const kindClassOf = (kind: FieldKind): KindClass => CLASS_OF[kind]

type Entity = Pick<EntityDefinition, "fields">

/** The record columns every entity has, by name; `workspaceId` is not here: no tree may name it. */
const SYSTEM_FIELDS: Readonly<Record<string, ResolvedField>> = {
    id: { kind: "uuid", nullable: false, custom: false },
    version: { kind: "bigint", nullable: false, custom: false },
    createdAt: { kind: "timestamptz", nullable: false, custom: false },
    updatedAt: { kind: "timestamptz", nullable: false, custom: false },
}

/** A declared custom key can be used where its declaration says: filtered on, sorted on, or just read. */
const keyUsable = (key: CustomKeyDef, use: FieldUse): boolean => {
    if (use === "where") {
        return key.filter === true
    }
    return use === "order" ? key.sort === true : true
}

/**
 * Resolves a field name of an entity: a declared field (in `data`), a system field, or `<jsonbField>.<key>` naming a declared nested
 * key. The workspace field is refused everywhere (the workspace comes from the scope only, plan 5).
 */
export const resolveField = (entity: Entity, name: string, use: FieldUse): FieldResolution => {
    const dot = name.indexOf(".")
    const head = dot < 0 ? name : name.slice(0, dot)
    if (head === "workspaceId") {
        return { ok: false, code: "QUERY_OWNER_FIELD" }
    }
    const system = ownEntry(SYSTEM_FIELDS, head)
    if (system !== undefined) {
        return dot < 0 ? { ok: true, field: system } : { ok: false, code: "QUERY_FIELD_UNKNOWN" }
    }
    const def = ownEntry(entity.fields, head)
    if (def === undefined || (dot >= 0 && def.kind !== "jsonb")) {
        return { ok: false, code: "QUERY_FIELD_UNKNOWN" }
    }
    if (dot < 0) {
        return { ok: true, field: { kind: def.kind, nullable: def.nullable, custom: false } }
    }
    const key = ownEntry(def.keys ?? {}, name.slice(dot + 1))
    return key !== undefined && keyUsable(key, use)
        ? { ok: true, field: { kind: key.kind, nullable: true, custom: true } }
        : { ok: false, code: "QUERY_CUSTOM_KEY_UNDECLARED" }
}
