/**
 * The generic shapes of a message sent to a customer: the files and the order card a line carries. The engine's send tool, its delivery
 * ledger and every package that tells a customer something know these; no conversation or record type appears here.
 */

/** A picture or file a line carries: a photo, an album frame, a payment QR. */
export interface LineFile {
    /** The id of the file. */
    readonly id: string
    /** Where the file is served from. */
    readonly url: string
    /** The name of the file, which names its link. */
    readonly name: string
    /** The media type, which tells a picture from another file. */
    readonly contentType: string
}

/** One ordered item on an order card of a line: the name, how many, the price of one and of the line in words, and the photo of the catalogue item. */
export interface LineOrderItem {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
    /** The price of one with its currency; absent while the order has no price for it. */
    readonly unitText?: string | undefined
    /** What the line comes to with its currency; absent while unknown. */
    readonly amountText?: string | undefined
    /** The photo of the catalogue item; absent draws a sprout. */
    readonly imageUrl?: string | null | undefined
}

/** The order a line is about, as the customer saw it: a snapshot taken when the line was sent. */
export interface LineOrder {
    /** The order number. */
    readonly orderNo: string
    /** One entry per ordered item. */
    readonly lines: ReadonlyArray<LineOrderItem>
    /** The total with its currency. */
    readonly amountText: string
    /** The delivery line (where to deliver); empty when unknown. */
    readonly address: string
    /** Whether the order was paid when the line was sent. */
    readonly paid: boolean
}
