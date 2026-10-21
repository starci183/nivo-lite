/** The columns of a lead an executor reads. */
export interface LeadReadRow {
    /** The lead id. */
    readonly id: string
    /** The name the customer goes by. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** The channel it came from. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage. */
    readonly stage: string
    /** The phone number. */
    readonly phone: string | null
    /** The email address. */
    readonly email: string | null
}

/** The columns of a conversation an executor reads. */
export interface ConversationReadRow {
    /** The conversation id. */
    readonly id: string
    /** The channel. */
    readonly channel: string
    /** The person who took it over. */
    readonly handled_by: string | null
    /** The name the visitor gave. */
    readonly visitor_name: string | null
    /** The lead. */
    readonly lead_id: string | null
}

/** The columns of a lead a scan reads. */
export interface ScanLeadRow {
    /** The lead id. */
    readonly id: string
    /** The stage. */
    readonly stage: string
    /** When it was created. */
    readonly created_at: string
}

/** The last activity of a lead. */
export interface LeadActivityRow {
    /** The lead. */
    readonly lead_id: string
    /** The instant of its last event. */
    readonly last_at: string
}

/** The figures of the day report. */
export interface DayFiguresRow {
    /** New leads. */
    readonly new_leads: number
    /** Confirmed orders. */
    readonly confirmed_orders: number
    /** The total of the confirmed orders (a bigint the driver answers as text). */
    readonly confirmed_total: string | number
    /** Money received (a bigint the driver answers as text). */
    readonly money_in: string | number
    /** Leads won. */
    readonly won_leads: number
    /** The summaries of the decisions waiting. */
    readonly waiting: ReadonlyArray<string | null>
}

/** The columns of an invoice the debt reminder reads. */
export interface DebtInvoiceRow {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoice_no: string
    /** The amount in VND. */
    readonly amount_vnd: number
    /** The customer. */
    readonly lead_id: string | null
    /** When it was due. */
    readonly due_at: string | null
}

/** The columns of an order the delivery notice reads. */
export interface OrderReadRow {
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

/** The columns of a contract the renewal reminder reads. */
export interface ContractReadRow {
    /** The contract id. */
    readonly id: string
    /** The customer's name. */
    readonly customer_name: string
    /** The customer. */
    readonly lead_id: string | null
    /** The plan. */
    readonly plan: string
    /** The end date, `yyyy-mm-dd`. */
    readonly ends_on: string
    /** The status. */
    readonly status: string
}
