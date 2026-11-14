import type { EntityDefinition } from "./entity.types"
import { expectedChecks, expectedExcludes, expectedIndexes, expectedView } from "./plan-expect"
import { partitionNameOf } from "./partition-name"

/**
 * One entity of `db/entities.manifest.json`, the file harness drift (R333) compares with the database.
 *
 * Shape (version 1):
 *   { "version": 1, "entities": [ { "entity": "sales.lead", "partition": "records_sales_lead",
 *       "view": "v_records_sales_lead", "checks": ["records_sales_lead_name_chk", ...], "indexes": ["records_sales_lead_recent_idx", ...] } ] }
 * - `entity` the `records.entity` value; `partition` the partition table, `records_<snake(entity)>` cut at 63 bytes.
 * - `view` present only when the entity declares `view: true`; always `v_<partition>` cut at 63 bytes.
 * - `checks` every CHECK and EXCLUDE constraint name of the partition: `<partition>_<snake(field)>_chk` per field,
 *   `<partition>_<name>` per declared check or noOverlap constraint, and `<partition>_agent_scope_chk` (`agent_id IS NOT NULL`) on every
 *   partition; always present. (The `<partition>_agent_fk` foreign key to the agents is no check and is not listed.)
 * - `indexes` every index name of the partition besides the primary key: `<partition>_<name>` per declared index or unique
 *   constraint, `<partition>_<snake(field)>_trgm_idx`, `<partition>_<snake(field)>_<snake(key)>_idx`, `<partition>_<snake(field)>_gin_idx`;
 *   present only when not empty.
 * - names within `checks` and `indexes` are sorted ascending, and entities are sorted by `entity`, so the file is stable.
 */
export interface ManifestEntity {
    /** The entity name. */
    readonly entity: string
    /** The partition table name. */
    readonly partition: string
    /** The typed view name, when declared. */
    readonly view?: string
    /** CHECK and EXCLUDE constraint names. */
    readonly checks?: ReadonlyArray<string>
    /** Index names. */
    readonly indexes?: ReadonlyArray<string>
}

/** The whole manifest document. */
export interface EntityManifest {
    /** The manifest format version. */
    readonly version: 1
    /** One record per declared entity. */
    readonly entities: ReadonlyArray<ManifestEntity>
}

const sorted = (names: ReadonlyArray<string>): ReadonlyArray<string> =>
    [...names].sort((left, right) => left.localeCompare(right))

const manifestEntityOf = (entity: EntityDefinition): ManifestEntity => {
    const view = expectedView(entity)
    const checks = sorted([...expectedChecks(entity).map((check) => check.name), ...expectedExcludes(entity)])
    const indexes = sorted(expectedIndexes(entity).map((index) => index.name))
    return {
        entity: entity.name,
        partition: partitionNameOf(entity.name),
        ...(view === null ? {} : { view: view.name }),
        ...(checks.length === 0 ? {} : { checks }),
        ...(indexes.length === 0 ? {} : { indexes }),
    }
}

/** The manifest the app's `cli entities` command writes for the declared entities. */
export const manifestOf = (entities: ReadonlyArray<EntityDefinition>): EntityManifest => ({
    version: 1,
    entities: entities.map((entry) => manifestEntityOf(entry)).sort((left, right) => left.entity.localeCompare(right.entity)),
})
