import type { Secret } from "@modules/platform/config"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"

/** What the app root tells the entity engine: the declarations it serves and the key that signs its cursors. */
export interface EntityEngineOptions {
    /** Every entity the modules declare; the catalog the engine resolves names against. */
    readonly entities: ReadonlyArray<EntityDefinition>
    /** Every job the modules declare; the module-job processor runs a delivery by name. */
    readonly jobs: ReadonlyArray<JobDefinition>
    /** Names the running build; a job parked under another build is handed back to its queue when this one starts. */
    readonly buildId?: string | undefined
    /** A 32-byte base64 key; cursors are signed with a key derived from it. */
    readonly cursorKey: Secret
}

/** The part of the options the environment supplies. */
export type EntityEngineConfig = Pick<EntityEngineOptions, "cursorKey" | "buildId">
