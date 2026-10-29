/** One lead as the board and journey read it. */
export interface LeadView {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** The channel label. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The journey stage. */
    readonly stage: string
    /** The context brief, or null. */
    readonly context_summary: string | null
    /** The agent installation that captured it, when known. */
    readonly installation_id: string | null
    /** The creation time, ISO text. */
    readonly created_at: string
}

/** A lead as the readers of other capabilities show a name next to a record: who it is and where it stands. */
export interface LeadCard {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company. */
    readonly company: string
    /** The channel label. */
    readonly channel: string
    /** The journey stage. */
    readonly stage: string
    /** The email, or null. */
    readonly email: string | null
}

/** A lead reduced to what a dashboard counts: who, where it stands and when it came. */
export interface LeadSummary {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company. */
    readonly company: string
    /** The journey stage. */
    readonly stage: string
    /** When the lead was created. */
    readonly createdAt: Date
}

/** A lead that came in through the website channel. */
export interface WebsiteLead {
    /** The lead id. */
    readonly id: string
    /** When the lead was created. */
    readonly createdAt: Date
}

/** A lead as the public API lists it. */
export interface ApiLead {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company, empty when unknown. */
    readonly company: string
    /** The channel the customer came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage of the deal. */
    readonly stage: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** When the customer was created. */
    readonly createdAt: Date
}

/** A lead reduced to who it is. */
export interface LeadName {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company, empty when unknown. */
    readonly company: string
}
