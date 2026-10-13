/** The safe columns the action status query reads. */
export interface SalesActionRow {
    /** The outbox id. */
    readonly id: string
    /** Queued, running, done or failed. */
    readonly state: string
    /** The target step, when this is a work decision. */
    readonly work_item_id: string | null
    /** The target step's current state. */
    readonly work_status: string | null
    /** Whether the scoped work item, legacy card or shipped order still exists. */
    readonly target_found: boolean
}
