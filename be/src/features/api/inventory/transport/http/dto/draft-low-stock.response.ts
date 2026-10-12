/** The HTTP response of draft purchase orders for low items. */
export class DraftLowStockResponse {
    /** Purchase orders drafted. */
    drafted!: number
    /** Items found low. */
    low!: number
}
