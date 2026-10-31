/** A waiting customer-reply work item. */
export interface WaitingRow {
    /** The stored id value. */
    readonly id: string
    /** The stored subject id value. */
    readonly subject_id: string | null
    /** The stored proposal value. */
    readonly proposal: Readonly<Record<string, unknown>> | null
    /** The stored assigned staff id value. */
    readonly assigned_staff_id: string | null
    /** The stored created at value. */
    readonly created_at: Date | string
}

/** The lead name, stage and capture time. */
export interface LeadBriefRow {
    /** The stored id value. */
    readonly id: string
    /** The stored contact name value. */
    readonly contact_name: string
    /** The stored company value. */
    readonly company: string
    /** The stored need value. */
    readonly need: string
    /** The stored stage value. */
    readonly stage: string
    /** The stored created at value. */
    readonly created_at: Date | string
}

/** The customer facts beside a thread. */
export interface LeadRow {
    /** The stored id value. */
    readonly id: string
    /** The stored contact name value. */
    readonly contact_name: string
    /** The stored company value. */
    readonly company: string
    /** The stored stage value. */
    readonly stage: string
    /** The stored need value. */
    readonly need: string
    /** The stored phone value. */
    readonly phone: string | null
    /** The stored email value. */
    readonly email: string | null
}

/** A Chatbot installation and its agent binding. */
export interface ChatbotInstallationRow {
    /** The stored id value. */
    readonly id: string
    /** The stored agent id value. */
    readonly agent_id: string | null
}
