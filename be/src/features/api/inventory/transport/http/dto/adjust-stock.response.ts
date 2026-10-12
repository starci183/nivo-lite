/** The HTTP response of change one item's quantity by hand. */
export class AdjustStockResponse {
    /** `applied` when the change is in, `waiting` when the owner must approve it. */
    state!: "applied" | "waiting"
    /** The level before the change. */
    before?: number
    /** The level after the change. */
    after?: number
    /** The decision waiting for the owner. */
    workItemId?: string
}
