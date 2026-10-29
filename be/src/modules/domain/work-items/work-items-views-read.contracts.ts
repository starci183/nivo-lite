import type { WorkItem } from "./work-items.contracts"

/** One page of work items asked for: no status filter when `statuses` is empty, no action filter when `action` is null. */
export interface WorkItemsPageQuery {
    /** The statuses to keep. */
    readonly statuses: ReadonlyArray<string>
    /** The keyset position after which the page starts. */
    readonly after: { readonly createdAt: string; readonly id: string } | null
    /** The action to keep. */
    readonly action: string | null
    /** How many rows. */
    readonly limit: number
}

/** A work item with its creation instant at full precision: the keyset cursor of the next page. */
export interface WorkItemWithCursor {
    /** The item. */
    readonly item: WorkItem
    /** The creation instant as ISO text at full precision. */
    readonly cursorAt: string
}
