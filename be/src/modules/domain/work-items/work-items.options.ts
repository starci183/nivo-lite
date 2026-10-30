import type { Type } from "@nestjs/common"
import type { WorkItemsLeadDirectory } from "./work-items.port"

/** The classes that implement the ports of the other capabilities. */
export interface WorkItemsPorts {
    /** Implements the lead directory port; an existing provider of the app (the leads capability). */
    readonly leads: Type<WorkItemsLeadDirectory>
}

/** What the work items capability needs from the app root. */
export interface WorkItemsOptions {
    /** The owners of its ports. */
    readonly ports: WorkItemsPorts
}
