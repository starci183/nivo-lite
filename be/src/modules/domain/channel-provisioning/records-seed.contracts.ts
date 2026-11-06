import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"

/** The schema name a records seed carries. */
export const RECORDS_SEED_SCHEMA = "nivo/records-seed@1"

/** One record a seed puts under the unique key of its entity: the entity declaration judges the values, the seed names nothing of any module. */
export interface SeedRecord {
    /** The entity, as the engine names it (for example `sales.settings`). */
    readonly entity: string
    /** The name of the unique constraint the record is found by. */
    readonly on: string
    /** The field values; the engine refuses a value its declaration does not accept. */
    readonly values: MutationValues
}
