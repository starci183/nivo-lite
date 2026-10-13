import type { WorkItem } from "../decisions.contracts"

/** public.work_items as the Decisions page reads it: timestamps arrive as ISO text, the CHECK columns narrowed. */
export interface WorkItemViewRow extends WorkItem {
    /** The creation instant at full precision: the keyset cursor of the next page. */
    cursor_at: string
}
