/** The columns of an order an automation delivery notice reads. */
export interface AutomationOrderRead {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly order_no: string
    /** The customer. */
    readonly lead_id: string | null
    /** When it was shipped. */
    readonly shipped_at: string | null
    /** The carrier. */
    readonly carrier: string | null
    /** The tracking code. */
    readonly tracking_code: string | null
}

/** One order of an automation delivery notice, or undefined when the workspace has none. */
export type OptionalAutomationOrderRead = AutomationOrderRead | undefined

/** The confirmed orders of a period as the day report counts them. */
export interface AutomationOrderFigures {
    /** How many orders were confirmed. */
    readonly count: number
    /** Their total in VND (a bigint the driver answers as text). */
    readonly total: string | number
}
