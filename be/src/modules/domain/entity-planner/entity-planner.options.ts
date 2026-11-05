import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"

/** What the importer hands the entity planner. */
export interface EntityPlannerOptions {
    /** The entity declarations the database must match (blocks-core `entities`; an injected list until it lands). */
    readonly entities: ReadonlyArray<EntityDefinition>
    /** The app root the migrations folder and `.starciwork` sit under; the working directory when absent. */
    readonly root?: string
}
