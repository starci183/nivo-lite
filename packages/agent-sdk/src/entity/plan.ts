import type {
    CatalogBase,
    CatalogIndex,
    CatalogPartition,
    CatalogPolicy,
    CatalogSnapshot,
    CatalogView,
    PlanOp,
    PlanOpKind,
} from "./catalog.types"
import type { EntityDefinition } from "./entity.types"
import {
    type ExpectedCheck,
    type ExpectedIndex,
    type ExpectedPolicy,
    type ExpectedView,
    expectedChecks,
    expectedExcludes,
    expectedIndexes,
    expectedPolicies,
    expectedPrivileges,
    expectedView,
    needsGist,
    needsTrigram,
} from "./plan-expect"
import { BASE_TABLES, baseTypeOf, ENGINE_ROLE, limitOf, literalsOf, normalizeSql, partId, tableId } from "./plan-names"
import { partitionNameOf } from "./partition-name"

const op = (kind: PlanOpKind, object: string, additive: boolean, reason: string): PlanOp => ({
    kind,
    object,
    additive,
    reason,
})

const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
    left.length === right.length && left.every((item, index) => item === right[index])

const indexMatches = (have: CatalogIndex, want: ExpectedIndex): boolean =>
    sameStrings(have.columns.map(normalizeSql), want.parts) &&
    have.unique === want.unique &&
    have.method === want.method &&
    (have.predicate !== null) === want.partial

const policyMatches = (have: CatalogPolicy, want: ExpectedPolicy): boolean =>
    sameStrings(have.roles, [ENGINE_ROLE]) &&
    have.command === want.command &&
    have.permissive &&
    (want.qual === null || (have.qual !== null && normalizeSql(have.qual) === want.qual)) &&
    (want.check === null || (have.check !== null && normalizeSql(have.check) === want.check))

/** Row level security, policies and grants of a base table (the policies sit on the parent, never on a partition). */
const baseOps = (name: string, base: CatalogBase | undefined): ReadonlyArray<PlanOp> => {
    if (base === undefined) {
        return [op("base_missing", tableId(name), false, `${name} does not exist: the base migration has not run`)]
    }
    const object = tableId(name)
    const wanted = expectedPrivileges
    const have = (base.grants.find((grant) => grant.role === ENGINE_ROLE)?.privileges ?? []).map((item) =>
        item.toLowerCase(),
    )
    const missing = wanted.filter((privilege) => !have.includes(privilege))
    const extra = have.filter((privilege) => !wanted.includes(privilege))
    return [
        ...(base.rlsEnabled ? [] : [op("enable_rls", object, true, "row level security on")]),
        ...expectedPolicies(name).flatMap((want) => {
            const policy = base.policies.find((candidate) => candidate.name === want.name)
            const id = partId(name, "policy", want.name)
            if (policy === undefined) {
                return [op("create_policy", id, true, `${want.command} for ${ENGINE_ROLE} on the engine workspace`)]
            }
            return policyMatches(policy, want)
                ? []
                : [op("alter_policy", id, false, "the policy exists with another definition")]
        }),
        ...(missing.length > 0
            ? [op("grant", partId(name, "grant", ENGINE_ROLE), true, `grant ${missing.join(", ")} to ${ENGINE_ROLE}`)]
            : []),
        ...(extra.length > 0
            ? [
                  op(
                      "revoke",
                      partId(name, "grant", ENGINE_ROLE),
                      false,
                      `${ENGINE_ROLE} holds ${extra.join(", ")} the engine does not use`,
                  ),
              ]
            : []),
    ]
}

/** The step a changed check needs: narrowing is destructive, widening is additive. */
const strictness = (id: string, narrows: boolean, widens: boolean): ReadonlyArray<PlanOp> => {
    if (narrows) return [op("narrow_check", id, false, "the declaration is stricter than the database check")]
    if (widens) return [op("replace_check", id, true, "the declaration is wider than the database check")]
    return []
}

/** One expected CHECK against the partition's constraints: missing, narrowed, widened, or not yet validated. */
const checkOps = (partition: CatalogPartition | null, name: string, want: ExpectedCheck): ReadonlyArray<PlanOp> => {
    const id = partId(name, "constraint", want.name)
    const have = partition?.constraints.find(
        (constraint) => constraint.name === want.name && constraint.kind === "check",
    )
    if (have === undefined) return [op("add_check", id, true, "added NOT VALID, then validated")]
    const values = literalsOf(have.definition).filter((value) => value !== want.key)
    const limit = limitOf(have.definition)
    const allowed = want.values ?? []
    const bound = want.limit ?? 0
    const narrows =
        (want.values !== null && values.some((value) => !allowed.includes(value))) ||
        (want.limit !== null && limit !== null && limit > bound)
    const widens =
        (want.values !== null && allowed.some((value) => !values.includes(value))) ||
        (want.limit !== null && limit !== null && limit < bound)
    return [
        ...strictness(id, narrows, widens),
        ...(have.validated ? [] : [op("validate_constraint", id, true, "added NOT VALID, not yet validated")]),
    ]
}

/** One expected index against the partition's indexes: created, altered, or satisfied by name or by structure. */
const indexOps = (partition: CatalogPartition | null, name: string, want: ExpectedIndex): ReadonlyArray<PlanOp> => {
    const id = partId(name, "index", want.name)
    const named = partition?.indexes.find((index) => index.name === want.name)
    if (named !== undefined) {
        return indexMatches(named, want)
            ? []
            : [op("alter_index", id, false, "the index exists with another definition")]
    }
    if (partition?.indexes.some((index) => indexMatches(index, want)) === true) return []
    return [
        op(
            want.constraint ? "add_unique" : "create_index",
            id,
            true,
            `on ${want.parts.join(", ")} using ${want.method}`,
        ),
    ]
}

/** What a good partition holds that the declaration does not name: dropping it is destructive. */
const orphanOps = (
    partition: CatalogPartition,
    checks: ReadonlyArray<ExpectedCheck>,
    excludes: ReadonlyArray<string>,
    indexes: ReadonlyArray<ExpectedIndex>,
): ReadonlyArray<PlanOp> => {
    const name = partition.name
    const constraintNames = new Set(partition.constraints.map((constraint) => constraint.name))
    const expectedNames = new Set([
        ...checks.map((check) => check.name),
        ...excludes,
        ...indexes.filter((index) => index.constraint).map((index) => index.name),
    ])
    const constraints = partition.constraints
        .filter(
            (constraint) =>
                ["check", "unique", "exclude"].includes(constraint.kind) && !expectedNames.has(constraint.name),
        )
        .map((constraint) =>
            op(
                "drop_constraint",
                partId(name, "constraint", constraint.name),
                false,
                "the declaration does not name it",
            ),
        )
    const stray = partition.indexes
        .filter(
            (index) =>
                !constraintNames.has(index.name) &&
                !indexes.some((want) => want.name === index.name || indexMatches(index, want)),
        )
        .map((index) => op("drop_index", partId(name, "index", index.name), false, "the declaration does not name it"))
    return [...constraints, ...stray]
}

const viewOps = (view: CatalogView | undefined, want: ExpectedView): ReadonlyArray<PlanOp> => {
    const object = tableId(want.name)
    if (view === undefined) return [op("create_view", object, true, `typed view with ${want.columns.length} columns`)]
    const same = sameStrings(
        view.columns.map((column) => `${column.name} ${baseTypeOf(column.type)}`),
        want.columns.map((column) => `${column.name} ${column.type}`),
    )
    return same ? [] : [op("alter_view", object, false, "the view exists with other columns")]
}

const entityOps = (entity: EntityDefinition, snapshot: CatalogSnapshot): ReadonlyArray<PlanOp> => {
    const name = partitionNameOf(entity.name)
    const byBound = snapshot.partitions.find((partition) => partition.bound === entity.name)
    const byName = snapshot.partitions.find((partition) => partition.name === name)
    const checks = expectedChecks(entity)
    const excludes = expectedExcludes(entity)
    const indexes = expectedIndexes(entity)
    const view = expectedView(entity)
    const viewPlan =
        view === null
            ? []
            : viewOps(
                  snapshot.views.find((candidate) => candidate.name === view.name),
                  view,
              )
    if (byBound !== undefined && byBound.name !== name) {
        return [
            op(
                "declaration_mismatch",
                tableId(byBound.name),
                false,
                `the partition of ${entity.name} is named ${byBound.name}, expected ${name}`,
            ),
        ]
    }
    if (byBound === undefined && byName !== undefined) {
        return [
            op(
                "declaration_mismatch",
                tableId(name),
                false,
                `${name} holds the values of ${byName.bound}, not ${entity.name}`,
            ),
        ]
    }
    const partition = byBound ?? null
    return [
        ...(partition === null
            ? [op("create_partition", tableId(name), true, `records for values in ('${entity.name}')`)]
            : []),
        ...checks.flatMap((want) => checkOps(partition, name, want)),
        ...excludes.flatMap((exclude) =>
            partition?.constraints.some(
                (constraint) => constraint.name === exclude && constraint.kind === "exclude",
            ) === true
                ? []
                : [
                      op(
                          "add_exclude",
                          partId(name, "constraint", exclude),
                          true,
                          "declared no-overlap (btree_gist EXCLUDE)",
                      ),
                  ],
        ),
        ...indexes.flatMap((want) => indexOps(partition, name, want)),
        ...(partition === null ? [] : orphanOps(partition, checks, excludes, indexes)),
        ...viewPlan,
    ]
}

/**
 * The difference between the declarations and the live catalog, as ordered steps. Pure: no SQL text, no I/O.
 * An empty plan means the database already matches (`cli entities check`). No data is preserved: dropping is a step like any other.
 */
export const planOf = (entities: ReadonlyArray<EntityDefinition>, snapshot: CatalogSnapshot): ReadonlyArray<PlanOp> => {
    const declared = new Set<string>(entities.map((entity) => entity.name))
    const views = new Set(entities.flatMap((entity) => expectedView(entity)?.name ?? []))
    return [
        ...(entities.some(needsTrigram) && !snapshot.extensions.includes("pg_trgm")
            ? [
                  op(
                      "create_extension",
                      "extension:pg_trgm",
                      true,
                      "trigram indexes on searchable text (allowlisted, R259)",
                  ),
              ]
            : []),
        ...(entities.some(needsGist) && !snapshot.extensions.includes("btree_gist")
            ? [op("create_extension", "extension:btree_gist", true, "EXCLUDE constraints (allowlisted, R259)")]
            : []),
        ...BASE_TABLES.flatMap((table) =>
            baseOps(
                table,
                snapshot.bases.find((base) => base.name === table),
            ),
        ),
        ...entities.flatMap((entity) => entityOps(entity, snapshot)),
        ...snapshot.partitions
            .filter((partition) => !declared.has(partition.bound))
            .map((partition) =>
                op("drop_partition", tableId(partition.name), false, `no entity declares ${partition.bound}`),
            ),
        ...snapshot.views
            .filter((view) => !views.has(view.name))
            .map((view) => op("drop_view", tableId(view.name), false, "no entity declares this view")),
    ]
}
