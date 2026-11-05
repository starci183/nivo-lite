import type { FilterExpr } from "../query/query.types"
import type { AnyEntityDefinition } from "./entity-any.types"
import type { ConstraintDef, EntityProblem, EntityProblemCode, FieldDef, IndexPart } from "./entity.types"
import { parseSequenceFormat } from "./sequence-format"

/** A custom key name: a plain identifier, so `<field>.<key>` stays unambiguous. */
const CUSTOM_KEY_NAME = /^[A-Za-z]\w{0,63}$/

/** The filter that matches everything: what an absent `where` reads as. */
const NO_FILTER: FilterExpr = { op: "and", of: [] }

/** The field names a filter reads (a `has` reads another entity and contributes none). */
export const filterFieldsOf = (expr: FilterExpr): ReadonlyArray<string> => {
    switch (expr.op) {
        case "and":
        case "or":
            return expr.of.flatMap(filterFieldsOf)
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

/** Whether `name` is a declared field, or `<jsonb field>.<declared key>`. */
const fieldKnown = (entity: AnyEntityDefinition, name: string): boolean => {
    if (hasOwn(entity.fields, name)) return true
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

const checkOwnership = (entity: AnyEntityDefinition, report: Report): void => {
    if (!hasOwn(entity.fields, entity.ownership.workspace))
        report("ENTITY_WORKSPACE_FIELD_MISSING", "ownership.workspace")
    if (!hasOwn(entity.fields, entity.key)) report("ENTITY_KEY_FIELD_MISSING", "key")
    if (!hasOwn(entity.fields, entity.version)) report("ENTITY_VERSION_FIELD_MISSING", "version")
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
    if (field.kind === "sequence" && (field.format === undefined || parseSequenceFormat(field.format) === undefined)) {
        report("ENTITY_SEQUENCE_FORMAT_INVALID", at)
    }
    checkJsonb(name, field, report)
}

const checkColumns = (entity: AnyEntityDefinition, report: Report): void => {
    const seen = new Set<string>()
    for (const [name, field] of Object.entries(entity.fields)) {
        if (seen.has(field.column)) report("ENTITY_COLUMN_DUPLICATE", `fields.${name}`)
        seen.add(field.column)
        checkField(name, field, report)
    }
}

const checkIndexPart = (entity: AnyEntityDefinition, part: IndexPart, at: string, report: Report): void => {
    const name = partFieldName(part)
    if (typeof part === "object" && "key" in part) {
        if (!hasOwn(entity.fields, name)) report("ENTITY_INDEX_FIELD_UNKNOWN", at)
        else if (!fieldKnown(entity, `${name}.${part.key[1]}`)) report("ENTITY_CUSTOM_KEY_INVALID", at)
    } else if (!hasOwn(entity.fields, name)) report("ENTITY_INDEX_FIELD_UNKNOWN", at)
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

/** Whether both sides of a toOne hold a uuid workspace column the join can equate, and the join does not run through it. */
const joinedInWorkspace = (entity: AnyEntityDefinition, target: AnyEntityDefinition, via: string): boolean => {
    const own = entity.fields[entity.ownership.workspace]
    const theirs = target.fields[target.ownership.workspace]
    return own?.kind === "uuid" && theirs?.kind === "uuid" && via !== entity.ownership.workspace
}

const checkRelations = (
    entity: AnyEntityDefinition,
    catalog: ReadonlyMap<string, AnyEntityDefinition>,
    report: Report,
): void => {
    for (const [name, relation] of Object.entries(entity.relations ?? {})) {
        const at = `relations.${name}`
        const target = relation.target === entity.name ? entity : catalog.get(relation.target)
        if (target === undefined) {
            report("ENTITY_RELATION_TARGET_UNKNOWN", at)
            continue
        }
        const owner = relation.kind === "toOne" ? entity : target
        if (!hasOwn(owner.fields, relation.via)) report("ENTITY_RELATION_TARGET_UNKNOWN", `${at}.via`)
        if (relation.kind === "toOne" && !joinedInWorkspace(entity, target, relation.via)) {
            report("ENTITY_RELATION_NOT_WORKSPACE_JOINED", at)
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
 * The problems of one declaration that need no other entity: the ownership, key and version fields, the columns, the field kinds,
 * the indexes, constraints and match keys. `defineEntity` refuses on these at module load.
 */
export const entityLocalProblems = (entity: AnyEntityDefinition): ReadonlyArray<EntityProblem> =>
    collect(entity, [
        (report) => checkOwnership(entity, report),
        (report) => checkColumns(entity, report),
        (report) => checkIndexes(entity, report),
        (report) => checkConstraintsAndKeys(entity, report),
    ])

/**
 * Every problem of a declaration against the catalog of the entities it may name: the local problems plus the relations (target
 * known, to-one joined inside one workspace) and the projection sources. An empty list means the declaration is sound.
 */
export const entityProblems = (
    entity: AnyEntityDefinition,
    catalog: ReadonlyMap<string, AnyEntityDefinition>,
): ReadonlyArray<EntityProblem> => [
    ...entityLocalProblems(entity),
    ...collect(entity, [
        (report) => checkRelations(entity, catalog, report),
        (report) => checkProjection(entity, catalog, report),
    ]),
]
