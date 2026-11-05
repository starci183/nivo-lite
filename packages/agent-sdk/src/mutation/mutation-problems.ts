import type { FieldDef, RelationDef } from "../entity/entity.types"
import type { AnyEntityDefinition } from "../entity/entity-any.types"
import { fieldValueSchema } from "./field-value"
import { recordId } from "./mutation-value.schema"
import type {
    Mutation,
    MutationBy,
    MutationLinks,
    MutationProblem,
    MutationProblemCode,
    MutationValues,
} from "./mutation.types"

/** The record columns every entity has; they are never written through `values`. */
const SYSTEM_FIELDS: ReadonlySet<string> = new Set(["id", "version", "createdAt", "updatedAt"])

/** The column that holds the owning workspace; the engine sets it from the scope. */
const OWNER_FIELD = "workspaceId"

/** The entity of a name in a catalog, if declared. */
export const entityOf = (entities: ReadonlyArray<AnyEntityDefinition>, name: string): AnyEntityDefinition | undefined =>
    entities.find((entity) => entity.name === name)

/** An own member of a record only, so `constructor` or `__proto__` is no field and no relation. */
const own = <T>(record: Readonly<Record<string, T>> | undefined, name: string): T | undefined =>
    record !== undefined && Object.hasOwn(record, name) ? record[name] : undefined

const problem = (code: MutationProblemCode, at: string): MutationProblem => ({ code, at })

/** The problem a written field earns, if any: a reserved column, an unknown field, a sequence, or a value off its kind. */
const writeProblem = (
    entity: AnyEntityDefinition,
    name: string,
    value: MutationValues[string],
): MutationProblem | undefined => {
    const at = `${entity.name}.${name}`
    if (name === OWNER_FIELD) return problem("MUTATION_OWNER_FIELD", at)
    if (SYSTEM_FIELDS.has(name)) return problem("MUTATION_SYSTEM_FIELD", at)
    const field = own(entity.fields, name)
    if (field === undefined) return problem("MUTATION_FIELD_UNKNOWN", at)
    if (field.kind === "sequence") return problem("MUTATION_FIELD_SEQUENCE", at)
    return fieldValueSchema(field).safeParse(value).success ? undefined : problem("MUTATION_VALUE_INVALID", at)
}

const valuesProblems = (entity: AnyEntityDefinition, values: MutationValues): ReadonlyArray<MutationProblem> =>
    Object.entries(values)
        .map(([name, value]) => writeProblem(entity, name, value))
        .filter((found) => found !== undefined)

/** Whether a field must be given when a record is created: not null, no default, not filled by the engine. */
const required = (field: FieldDef): boolean =>
    !field.nullable && field.default === undefined && field.kind !== "sequence"

/** The fields a created record needs that `values` does not carry. */
const missingProblems = (entity: AnyEntityDefinition, values: MutationValues): ReadonlyArray<MutationProblem> =>
    Object.entries(entity.fields)
        .filter(([name, field]) => required(field) && !Object.hasOwn(values, name))
        .map(([name]) => problem("MUTATION_FIELD_MISSING", `${entity.name}.${name}`))

/** The fields a find-by-key names that `values` leaves out or sets to null: such a key never matches. */
const keyValueProblems = (
    entity: AnyEntityDefinition,
    on: ReadonlyArray<string>,
    values: MutationValues,
): ReadonlyArray<MutationProblem> =>
    on
        .filter((name) => (values[name] ?? null) === null)
        .map((name) => problem("MUTATION_KEY_VALUE_MISSING", `${entity.name}.${name}`))

/** The problem a record id earns: it must be a uuid. */
const keyProblems = (entity: AnyEntityDefinition, key: string): ReadonlyArray<MutationProblem> =>
    recordId.safeParse(key).success ? [] : [problem("MUTATION_KEY_INVALID", entity.name)]

/** The toOne relations an insert must link: declared `required`. */
const requiredLinks = (entity: AnyEntityDefinition): ReadonlyArray<[string, RelationDef]> =>
    Object.entries(entity.relations ?? {}).filter(
        ([, relation]) => relation.kind === "toOne" && relation.required === true,
    )

/** The problems of the links an insert carries: only declared toOne relations, each to a record id, and every required one present. */
const linksProblems = (entity: AnyEntityDefinition, links: MutationLinks): ReadonlyArray<MutationProblem> => [
    ...Object.entries(links).flatMap(([name, target]): ReadonlyArray<MutationProblem> => {
        const at = `${entity.name}.${name}`
        const relation = own(entity.relations, name)
        if (relation === undefined) return [problem("MUTATION_RELATION_UNKNOWN", at)]
        if (relation.kind !== "toOne") return [problem("MUTATION_RELATION_NOT_TO_ONE", at)]
        return recordId.safeParse(target).success ? [] : [problem("MUTATION_LINK_INVALID", at)]
    }),
    ...requiredLinks(entity)
        .filter(([name]) => !Object.hasOwn(links, name))
        .map(([name]) => problem("MUTATION_LINK_MISSING", `${entity.name}.${name}`)),
]

/** The problems of a link or unlink: a declared relation, a record id on both ends, and a required relation never unlinked. */
const relationProblems = (
    entity: AnyEntityDefinition,
    mutation: Extract<Mutation, { op: "link" | "unlink" }>,
): ReadonlyArray<MutationProblem> => {
    const at = `${entity.name}.${mutation.relation}`
    const relation = own(entity.relations, mutation.relation)
    return [
        ...keyProblems(entity, mutation.key),
        ...(recordId.safeParse(mutation.to).success ? [] : [problem("MUTATION_LINK_INVALID", at)]),
        ...(relation === undefined ? [problem("MUTATION_RELATION_UNKNOWN", at)] : []),
        ...(mutation.op === "unlink" && relation?.required === true ? [problem("MUTATION_LINK_REQUIRED", at)] : []),
    ]
}

/** The problems of one mutation against its entity: everything the engine would refuse before it builds a statement. */
const entityProblems = (entity: AnyEntityDefinition, mutation: Mutation): ReadonlyArray<MutationProblem> => {
    switch (mutation.op) {
        case "insert":
            return [
                ...valuesProblems(entity, mutation.values),
                ...missingProblems(entity, mutation.values),
                ...linksProblems(entity, mutation.links ?? {}),
            ]
        case "update":
            return [
                ...keyProblems(entity, mutation.key),
                ...valuesProblems(entity, mutation.values),
                ...(Object.keys(mutation.values).length === 0 ? [problem("MUTATION_VALUES_EMPTY", entity.name)] : []),
            ]
        case "delete":
            return [
                ...keyProblems(entity, mutation.key),
                ...(entity.deletable === true ? [] : [problem("MUTATION_NOT_DELETABLE", entity.name)]),
            ]
        case "link":
        case "unlink":
            return relationProblems(entity, mutation)
        case "upsert": {
            const unique = entity.constraints?.find((c) => c.kind === "unique" && c.name === mutation.on)
            if (unique?.kind !== "unique") return [problem("MUTATION_UNIQUE_UNKNOWN", `${entity.name}.${mutation.on}`)]
            return [
                ...valuesProblems(entity, mutation.values),
                ...missingProblems(entity, mutation.values),
                ...keyValueProblems(entity, unique.on, mutation.values),
            ]
        }
        case "ensure": {
            const match = entity.matchKeys?.find((key) => key.name === mutation.match)
            if (match === undefined) return [problem("MUTATION_MATCH_KEY_UNKNOWN", `${entity.name}.${mutation.match}`)]
            return [
                ...valuesProblems(entity, mutation.values),
                ...missingProblems(entity, mutation.values),
                ...keyValueProblems(entity, match.on, mutation.values),
            ]
        }
    }
}

/**
 * What is wrong with a mutation tree against the declared entities, empty when it is writable: an unknown entity, field, relation,
 * unique constraint or match key; the workspace field (`MUTATION_OWNER_FIELD`) or another system field (`MUTATION_SYSTEM_FIELD`) in
 * `values`; a sequence field written; a value off the field kind, bounds or declared jsonb shape; a created record missing a required
 * field or required link; a delete of an entity that is not `deletable`; a write to a projection entity by an action
 * (`MUTATION_PROJECTION_WRITE`, only a job writes one).
 */
export const mutationProblems = (
    mutation: Mutation,
    entities: ReadonlyArray<AnyEntityDefinition>,
    by: MutationBy,
): ReadonlyArray<MutationProblem> => {
    const entity = entityOf(entities, mutation.entity)
    if (entity === undefined) return [problem("MUTATION_ENTITY_UNKNOWN", mutation.entity)]
    if (by === "action" && entity.projection !== undefined) return [problem("MUTATION_PROJECTION_WRITE", entity.name)]
    return entityProblems(entity, mutation)
}
