import type { CatalogSnapshot, PlanOp } from "./catalog.types"
import type { EntityDefinition } from "./entity.types"
import { planOf } from "./plan"
import { expectedPolicies, expectedPrivileges } from "./plan-expect"
import { BASE_TABLES, ENGINE_ROLE } from "./plan-names"
import { renderOp } from "./render"

/**
 * The catalog of a fresh database the base migration ran on: the three base tables with row level security, the engine policies and
 * grants, no partition and no view. What the declarations add to it is exactly their own DDL.
 */
const FRESH: CatalogSnapshot = {
    extensions: [],
    bases: BASE_TABLES.map((name) => ({
        name,
        rlsEnabled: true,
        rlsForced: false,
        policies: expectedPolicies(name).map((policy) => ({
            name: policy.name,
            roles: [ENGINE_ROLE],
            command: policy.command,
            permissive: true,
            qual: policy.qual,
            check: policy.check,
        })),
        grants: [{ role: ENGINE_ROLE, privileges: expectedPrivileges }],
    })),
    partitions: [],
    views: [],
}

const oneLine = (text: string): string => text.replaceAll(/\s+/g, " ").trim()

/** The DDL of one step, under its comment line. */
const blockOf = (op: PlanOp, entities: ReadonlyArray<EntityDefinition>): string =>
    [`-- ${op.kind} ${oneLine(op.object)}: ${oneLine(op.reason)}`, ...renderOp(op, entities).map((sql) => `${sql};`)].join("\n")

/**
 * The DDL a fresh database gets from the record type declarations: the planner's own steps (`planOf` against a fresh catalog) rendered
 * by its own renderer (`renderOp`), entities in name order, so the same declarations always give the same text. Pure: no database, no
 * I/O. The committed artefact (`db/entities.ddl.sql`) is compared with it by the project check `record-ddl`; it is what the baseline
 * carries at the build window. Throws `EntityRenderError` for a step the renderer cannot write.
 */
export const entitiesDdlOf = (entities: ReadonlyArray<EntityDefinition>): string => {
    const ordered = [...entities].sort((left, right) => left.name.localeCompare(right.name))
    const ops = planOf(ordered, FRESH)
    const header = [
        "-- GENERATED from the record type declarations (packages' defineRecordType / defineEntity) by `npm run records:ddl`; do not edit.",
        "-- The DDL a fresh database gets for the partitions of public.records: the planner's steps against a fresh catalog, entities in",
        "-- name order. Checked by `npm run records:check` (project check `record-ddl`). Not a migration: the build window's baseline carries it.",
        `-- Record types: ${ordered.length}.`,
    ]
    return `${header.join("\n")}\n\n${ops.map((op) => blockOf(op, ordered)).join("\n\n")}\n`
}
