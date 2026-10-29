/** A waiting customer as other capabilities read it. */
export interface BookingWaitRecord {
    /** The entry id. */
    readonly id: string
    /** The customer name. */
    readonly customerName: string
    /** The customer phone, or null. */
    readonly customerPhone: string | null
    /** The service waited for. */
    readonly serviceId: string
    /** The beginning of the wanted window. */
    readonly windowStart: Date
    /** The end of the wanted window. */
    readonly windowEnd: Date
    /** The number of customers. */
    readonly partySize: number
    /** The status, waiting or notified. */
    readonly status: string
}
