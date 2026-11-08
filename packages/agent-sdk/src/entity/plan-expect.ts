import type { EntityDefinition, FieldDef, IndexPart } from "./entity.types"
import {
    type EngineCommand,
    PG_TYPE,
    POLICY_COMMANDS,
    identOf,
    normalizeSql,
    policyNameOf,
    snakeOf,
    viewNameOf,
} from "./plan-names"
import { partitionNameOf } from "./partition-name"

/** An index the declaration implies, parts already normalized. */
export interface ExpectedIndex {
    /** The index name. */
    readonly name: string
    /** The normalized parts, `workspace_id` first. */
    readonly parts: ReadonlyArray<string>
    /** A unique index. */
    readonly unique: boolean
    /** The access method. */
    readonly method: string
    /** A partial index. */
    readonly partial: boolean
    /** Declared as a unique constraint rather than an index. */
    readonly constraint: boolean
}

/** A CHECK the declaration implies. */
export interface ExpectedCheck {
    /** The constraint name. */
    readonly name: string
    /** The data key the check is about (its name is not an enum value), or null for a declared check. */
    readonly key: string | null
    /** An enum field: the allowed values; null when the check is not compared by value. */
    readonly values: ReadonlyArray<string> | null
    /** A bounded text field: the length bound; null when absent. */
    readonly limit: number | null
}

/** An engine policy a base table must have. */
export interface ExpectedPolicy {
    /** The policy name. */
    readonly name: string
    /** The command it covers. */
    readonly command: EngineCommand
    /** Normalized USING text, null when the command has none. */
    readonly qual: string | null
    /** Normalized WITH CHECK text, null when the command has none. */
    readonly check: string | null
}

/** The typed view an entity declares. */
export interface ExpectedView {
    /** The view name. */
    readonly name: string
    /** Its columns, in order. */
    readonly columns: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

/** The record columns every entity has, by system field name. */
const SYSTEM_COLUMNS: Readonly<Record<string, string>> = {
    id: "id",
    workspaceId: "workspace_id",
    version: "version",
    createdAt: "created_at",
    updatedAt: "updated_at",
}

const SYSTEM_TYPES: ReadonlyArray<{ readonly name: string; readonly type: string }> = [
    { name: "id", type: "uuid" },
    { name: "workspace_id", type: "uuid" },
    { name: "version", type: "bigint" },
    { name: "created_at", type: "timestamp with time zone" },
    { name: "updated_at", type: "timestamp with time zone" },
]

/** The expression naming a field: its record column when it is a system field, else the `data` key. */
const exprOf = (field: string): string => SYSTEM_COLUMNS[field] ?? `data->>'${field}'`

const partOf = (part: IndexPart): string => {
    if (typeof part === "string") return normalizeSql(exprOf(part))
    if ("fold" in part) return normalizeSql(`knowledge_fold(${exprOf(part.fold)})`)
    if ("desc" in part) return normalizeSql(`${exprOf(part.desc)} desc`)
    return normalizeSql(`data->'${part.key[0]}'->>'${part.key[1]}'`)
}

const WORKSPACE = "workspace_id"

/** The normalized text of the workspace predicate every engine policy uses. */
export const WORKSPACE_PREDICATE: string = normalizeSql(`${WORKSPACE} = public.engine_workspace()`)

const generated = (partition: string, name: string, parts: ReadonlyArray<string>, method: string): ExpectedIndex => ({
    name: identOf(`${partition}_${name}`),
    parts: parts.map((part) => normalizeSql(part)),
    unique: false,
    method,
    partial: false,
    constraint: false,
})

const fieldIndexes = (partition: string, name: string, field: FieldDef): ReadonlyArray<ExpectedIndex> => [
    ...(field.searchable === true
        ? [generated(partition, `${snakeOf(name)}_trgm_idx`, [`knowledge_fold(data->>'${name}')`], "gin")]
        : []),
    ...Object.entries(field.keys ?? {})
        .filter(([, key]) => key.filter === true || key.sort === true)
        .map(([key]) =>
            generated(
                partition,
                `${snakeOf(name)}_${snakeOf(key)}_idx`,
                [WORKSPACE, `data->'${name}'->>'${key}'`],
                "btree",
            ),
        ),
    ...(field.freeKeys === true ? [generated(partition, `${snakeOf(name)}_gin_idx`, [`data->'${name}'`], "gin")] : []),
]

/** Every index the declaration implies: workspace-first declared indexes and uniques, trigram for searchable text, expression indexes for nested keys, GIN for free keys. */
export const expectedIndexes = (entity: EntityDefinition): ReadonlyArray<ExpectedIndex> => {
    const partition = partitionNameOf(entity.name)
    return [
        ...(entity.indexes ?? []).map((index) => ({
            name: identOf(`${partition}_${index.name}`),
            parts: [normalizeSql(WORKSPACE), ...index.on.map((part) => partOf(part))],
            unique: index.unique === true,
            method: index.using ?? "btree",
            partial: index.where !== undefined,
            constraint: false,
        })),
        ...(entity.constraints ?? []).flatMap((constraint) =>
            constraint.kind === "unique"
                ? [
                      {
                          name: identOf(`${partition}_${constraint.name}`),
                          parts: [normalizeSql(WORKSPACE), ...constraint.on.map((field) => partOf(field))],
                          unique: true,
                          method: "btree",
                          partial: constraint.where !== undefined,
                          constraint: true,
                      },
                  ]
                : [],
        ),
        ...Object.entries(entity.fields).flatMap(([name, field]) => fieldIndexes(partition, name, field)),
    ]
}

/** The CHECKs of a partition: one per field (kind cast, enum values, text length, presence) and every declared check. */
export const expectedChecks = (entity: EntityDefinition): ReadonlyArray<ExpectedCheck> => {
    const partition = partitionNameOf(entity.name)
    return [
        ...Object.entries(entity.fields).map(([name, field]) => ({
            name: identOf(`${partition}_${snakeOf(name)}_chk`),
            key: name,
            values: field.kind === "enum" && field.of !== undefined ? field.of : null,
            limit: field.kind === "text" && field.maxLength !== undefined ? field.maxLength : null,
        })),
        ...(entity.constraints ?? []).flatMap((constraint) =>
            constraint.kind === "check"
                ? [{ name: identOf(`${partition}_${constraint.name}`), key: null, values: null, limit: null }]
                : [],
        ),
    ]
}

/** The EXCLUDE constraint names of a partition. */
export const expectedExcludes = (entity: EntityDefinition): ReadonlyArray<string> => {
    const partition = partitionNameOf(entity.name)
    return (entity.constraints ?? []).flatMap((constraint) =>
        constraint.kind === "noOverlap" ? [identOf(`${partition}_${constraint.name}`)] : [],
    )
}

/** The typed view of an entity, or null when it declares none. */
export const expectedView = (entity: EntityDefinition): ExpectedView | null =>
    entity.view === true
        ? {
              name: viewNameOf(partitionNameOf(entity.name)),
              columns: [
                  ...SYSTEM_TYPES,
                  ...Object.entries(entity.fields).map(([name, field]) => ({
                      name: snakeOf(name),
                      type: PG_TYPE[field.kind],
                  })),
              ],
          }
        : null

/** The four engine policies of a base table: every one confines the rows to the engine scope's workspace. */
export const expectedPolicies = (table: string): ReadonlyArray<ExpectedPolicy> =>
    POLICY_COMMANDS.map((command) => ({
        name: policyNameOf(table, command),
        command,
        qual: command === "insert" ? null : WORKSPACE_PREDICATE,
        check: command === "insert" || command === "update" ? WORKSPACE_PREDICATE : null,
    }))

/** The table privileges app_engine gets on every base table; which rows it may delete is the policy's and the engine's business. */
export const expectedPrivileges: ReadonlyArray<string> = ["select", "insert", "update", "delete"]

/** Whether any field asks for a trigram index (the pg_trgm extension). */
export const needsTrigram = (entity: EntityDefinition): boolean =>
    Object.values(entity.fields).some((field) => field.searchable === true)

/** Whether any constraint is a no-overlap EXCLUDE (the btree_gist extension). */
export const needsGist = (entity: EntityDefinition): boolean => expectedExcludes(entity).length > 0
