/** A customer who wants to be told when a slot of a service opens in a window. */
export interface WaitlistEntry {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer lead, when known. */
    readonly leadId: string | null
    /** The chat the customer asked in, when they asked in one. */
    readonly conversationId: string | null
    /** The customer's name. */
    readonly customerName: string
    /** The customer's phone, when given. */
    readonly customerPhone: string | null
    /** The service. */
    readonly serviceId: string
    /** The start of the window, ISO 8601. */
    readonly windowStart: string
    /** The end of the window, ISO 8601. */
    readonly windowEnd: string
    /** How many people come. */
    readonly partySize: number
    /** What the customer added. */
    readonly note: string
}
