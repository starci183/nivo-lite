import type { FilterExpr } from "../query/query.types"
import { isNamespaced } from "../schema/namespaced"
import type { AnyEntityDefinition } from "./entity-any.types"
import type { ConstraintDef, EntityProblem, EntityProblemCode, FieldDef, IndexPart } from "./entity.types"
import { partitionNameOf } from "./partition-name"
import { sequenceDeclarationValid } from "./sequence-format"
import { SYSTEM_FIELDS } from "./system-fields"

/** A custom key name: a plain identifier, so `<field>.<key>` stays unambiguous. */
const CUSTOM_KEY_NAME = /^[A-Za-z]\w{0,63}$/

/** A declared field name: lower camelCase, so it is a stable `data` key. */
const FIELD_NAME = /^[a-z][a-zA-Z0-9]{0,63}$/

const SYSTEM: ReadonlySet<string> = new Set(SYSTEM_FIELDS)

/** The filter that matches everything: what an absent `where` reads as. */
const NO_FILTER: FilterExpr = { op: "and", of: [] }

/** The field names a filter reads (a `has` reads another entity and contributes none). */
export const filterFieldsOf = (expr: FilterExpr): ReadonlyArray<string> => {
    switch (expr.op) {
        case "and":
        case "or":
            return expr.of.flatMap((inner) => filterFieldsOf(inner))
        case "not":
            return filterFieldsOf(expr.of)
        case "has":
            return []
        case "search":
            return expr.fields
        case "overlaps":
            return expr.range
        case "in":
        case "notIn":
        case "isNull":
        case "notNull":
            return [expr.field]
        case "eq":
        case "ne":
        case "lt":
        case "lte":
        case "gt":
        case "gte":
            return expr.ref === undefined ? [expr.field] : [expr.field, expr.ref]
    }
}

const hasOwn = (record: object, key: string): boolean => Object.hasOwn(record, key)

/** Whether `name` is a declared field or a system field. */
const plainKnown = (entity: AnyEntityDefinition, name: string): boolean =>
    SYSTEM.has(name) || hasOwn(entity.fields, name)

/** Whether `name` is a declared or system field, or `<jsonb field>.<declared key>`. */
const fieldKnown = (entity: AnyEntityDefinition, name: string): boolean => {
    if (plainKnown(entity, name)) return true
    const dot = name.indexOf(".")
    if (dot < 0) return false
    const field = entity.fields[name.slice(0, dot)]
    return field?.kind === "jsonb" && hasOwn(field.keys ?? {}, name.slice(dot + 1))
}

const partFieldName = (part: IndexPart): string => {
    if (typeof part === "string") return part
    if ("fold" in part) return part.fold
    if ("desc" in part) return part.desc
    return part.key[0]
}

const constraintFields = (constraint: ConstraintDef): ReadonlyArray<string> => {
    switch (constraint.kind) {
        case "unique":
            return [...constraint.on, ...filterFieldsOf(constraint.where ?? NO_FILTER)]
        case "check":
            return filterFieldsOf(constraint.expr)
        case "noOverlap":
            return [...constraint.equal, ...constraint.range, ...filterFieldsOf(constraint.where ?? NO_FILTER)]
    }
}

/** The collector every check pushes into; `at` is the path inside the entity. */
type Report = (code: EntityProblemCode, at: string) => void

const checkName = (entity: AnyEntityDefinition, report: Report): void => {
    if (!isNamespaced(entity.name)) report("ENTITY_NAME_INVALID", "name")
}

const checkJsonb = (name: string, field: FieldDef, report: Report): void => {
    if (field.kind !== "jsonb") {
        if (field.keys !== undefined || field.freeKeys !== undefined)
            report("ENTITY_CUSTOM_KEY_INVALID", `fields.${name}`)
        return
    }
    if (field.shape === undefined) report("ENTITY_JSONB_SHAPE_MISSING", `fields.${name}`)
    for (const key of Object.keys(field.keys ?? {})) {
        if (!CUSTOM_KEY_NAME.test(key)) {
            report("ENTITY_CUSTOM_KEY_INVALID", `fields.${name}.keys.${key}`)
        }
    }
}

const checkField = (name: string, field: FieldDef, report: Report): void => {
    const at = `fields.${name}`
    if (
        field.kind === "text" &&
        (field.maxLength === undefined || !Number.isInteger(field.maxLength) || field.maxLength < 1)
    ) {
        report("ENTITY_TEXT_UNBOUNDED", at)
    }
    if (field.kind === "enum" && field.of === undefined) report("ENTITY_ENUM_EMPTY", at)
    if (field.kind === "sequence" && !sequenceDeclarationValid(field.format, field.resets)) {
        report("ENTITY_SEQUENCE_FORMAT_INVALID", at)
    }
    checkJsonb(name, field, report)
}

const checkFields = (entity: AnyEntityDefinition, report: Report): void => {
    for (const [name, field] of Object.entries(entity.fields)) {
        if (SYSTEM.has(name)) report("ENTITY_FIELD_RESERVED", `fields.${name}`)
        else if (!FIELD_NAME.test(name)) report("ENTITY_FIELD_NAME_INVALID", `fields.${name}`)
        checkField(name, field, report)
    }
}

const checkIndexPart = (entity: AnyEntityDefinition, part: IndexPart, at: string, report: Report): void => {
    const name = partFieldName(part)
    if (typeof part === "object" && "key" in part) {
        if (!hasOwn(entity.fields, name)) report("ENTITY_INDEX_FIELD_UNKNOWN", at)
        else if (!fieldKnown(entity, `${name}.${part.key[1]}`)) report("ENTITY_CUSTOM_KEY_INVALID", at)
    } else if (!plainKnown(entity, name)) report("ENTITY_INDEX_FIELD_UNKNOWN", at)
}

const checkIndexes = (entity: AnyEntityDefinition, report: Report): void => {
    for (const index of entity.indexes ?? []) {
        const at = `indexes.${index.name}`
        for (const part of index.on) checkIndexPart(entity, part, at, report)
        for (const name of filterFieldsOf(index.where ?? NO_FILTER)) {
            if (!fieldKnown(entity, name)) report("ENTITY_INDEX_FIELD_UNKNOWN", at)
        }
    }
}

const checkConstraintsAndKeys = (entity: AnyEntityDefinition, report: Report): void => {
    for (const constraint of entity.constraints ?? []) {
        for (const name of constraintFields(constraint)) {
            if (!fieldKnown(entity, name)) report("ENTITY_CONSTRAINT_FIELD_UNKNOWN", `constraints.${constraint.name}`)
        }
    }
    for (const matchKey of entity.matchKeys ?? []) {
        for (const name of matchKey.on) {
            if (!fieldKnown(entity, name)) report("ENTITY_MATCH_KEY_FIELD_UNKNOWN", `matchKeys.${matchKey.name}`)
        }
    }
}

const checkRelations = (
    entity: AnyEntityDefinition,
    catalog: ReadonlyMap<string, AnyEntityDefinition>,
    report: Report,
): void => {
    for (const [name, relation] of Object.entries(entity.relations ?? {})) {
        if (relation.target !== entity.name && !catalog.has(relation.target)) {
            report("ENTITY_RELATION_TARGET_UNKNOWN", `relations.${name}`)
        }
    }
}

const checkProjection = (
    entity: AnyEntityDefinition,
    catalog: ReadonlyMap<string, AnyEntityDefinition>,
    report: Report,
): void => {
    for (const source of entity.projection?.sources ?? []) {
        if (source !== entity.name && !catalog.has(source))
            report("ENTITY_PROJECTION_SOURCE_UNKNOWN", `projection.sources.${source}`)
    }
}

const checkPartition = (
    entity: AnyEntityDefinition,
    catalog: ReadonlyMap<string, AnyEntityDefinition>,
    report: Report,
): void => {
    const partition = partitionNameOf(entity.name)
    for (const other of catalog.values()) {
        if (other.name !== entity.name && partitionNameOf(other.name) === partition) {
            report("ENTITY_PARTITION_NAME_TAKEN", "name")
            return
        }
    }
}

const collect = (
    entity: AnyEntityDefinition,
    checks: ReadonlyArray<(report: Report) => void>,
): ReadonlyArray<EntityProblem> => {
    const problems: Array<EntityProblem> = []
    const report: Report = (code, at) => {
        problems.push({ code, entity: entity.name, at })
    }
    for (const check of checks) check(report)
    return problems
}

/**
 * The problems of one declaration that need no other entity: the name, the field names (reserved system fields), the field kinds,
 * the indexes, constraints and match keys. `defineEntity` refuses on these at module load.
 */
export const entityLocalProblems = (entity: AnyEntityDefinition): ReadonlyArray<EntityProblem> =>
    collect(entity, [
        (report) => checkName(entity, report),
        (report) => checkFields(entity, report),
        (report) => checkIndexes(entity, report),
        (report) => checkConstraintsAndKeys(entity, report),
    ])

/**
 * Every problem of a declaration against the catalog of the entities it may name: the local problems plus the relation targets,
 * the projection sources and a partition name another entity already maps to. An empty list means the declaration is sound.
 */
export const entityProblems = (
    entity: AnyEntityDefinition,
    catalog: ReadonlyMap<string, AnyEntityDefinition>,
): ReadonlyArray<EntityProblem> => [
    ...entityLocalProblems(entity),
    ...collect(entity, [
        (report) => checkRelations(entity, catalog, report),
        (report) => checkProjection(entity, catalog, report),
        (report) => checkPartition(entity, catalog, report),
    ]),
]
