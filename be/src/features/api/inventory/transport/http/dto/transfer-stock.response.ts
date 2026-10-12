/** The HTTP response of move goods between two locations. */
export class TransferStockResponse {
    /** The level left at the source. */
    from!: number
    /** The level at the target. */
    to!: number
}
