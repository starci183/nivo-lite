/** The HTTP response of apply a stock count. */
export class StockTakeResponse {
    /** Changes applied now. */
    applied!: number
    /** Changes waiting for the owner. */
    waiting!: number
    /** Items whose count matched. */
    same!: number
}
