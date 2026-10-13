/** public.messages, the columns a command is read from. */
export interface MessageTextRow {
    /** The message id. */
    id: string
    /** Constrained by a CHECK in the table. */
    author_kind: "human" | "agent" | "system"
    /** The text. */
    body: string
}

/** public.agents, the columns a mention is resolved with. */
export interface MentionedAgentRow {
    /** The agent id. */
    id: string
    /** The handle. */
    handle: string
    /** The module the agent belongs to. */
    module: string
    /** The display name. */
    name: string
}

/** public.leads, the columns a name is matched with. */
export interface LeadRefRow {
    /** The customer id. */
    id: string
    /** The customer's name. */
    contact_name: string
    /** The company, when known. */
    company: string | null
}

/** public.orders, the columns an order number is matched with. */
export interface OrderRefRow {
    /** The order id. */
    id: string
    /** The order number. */
    order_no: string
    /** The customer, when linked. */
    lead_id: string | null
}

/** The id of a row an UPDATE touched. */
export interface TouchedRow {
    /** The row id. */
    id: string
}
