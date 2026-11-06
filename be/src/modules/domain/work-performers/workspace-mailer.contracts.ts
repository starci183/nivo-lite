/** What an email is about (invoice, lead, transaction ids), by name. */
export interface EmailRefs {
    /** The id or number. */
    readonly [name: string]: string | number | null
}

/** An email to a customer: it goes through the authority gate and the workspace's own mail account. */
export interface CustomerEmail {
    /** The workspace. */
    readonly workspaceId: string
    /** The recipient. */
    readonly to: string
    /** The one-line subject. */
    readonly subject: string
    /** The plain-text body. */
    readonly body: string
    /** What the email is for. */
    readonly purpose: string
    /** What it is about. */
    readonly refs: EmailRefs
    /** Unique per email. */
    readonly dedupeKey: string
    /** The kind of thing the gate files the work under. */
    readonly subjectType: "transaction" | "invoice" | "lead"
    /** The id of that thing. */
    readonly subjectId: string | null
    /** The customer. */
    readonly leadId: string | null
}

/** What the mail integration did with an email. */
export interface MailOutcome {
    /** `sent`, `waiting_decision`, `no_smtp`, `blocked`, `failed`, `rate_limited`, `duplicate`. */
    readonly status: string
    /** How it went out (`smtp`, `platform`, `none`). */
    readonly via?: string
    /** The work item the gate opened. */
    readonly workItemId?: string | null
    /** The row of the email log. */
    readonly emailMessageId?: string | null
    /** The id the mail server gave. */
    readonly messageId?: string | null
    /** Why it did not go out. */
    readonly error?: string | null
}

/** The mail of the product: a customer is mailed through the authority gate. */
export interface WorkspaceMailer {
    /** Asks for an email to a customer to leave through the authority gate. */
    requestCustomerEmail(email: CustomerEmail): Promise<MailOutcome>
}
