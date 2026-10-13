/** The selected conversation columns. */
export interface ConversationRow {
    /** The stored id value. */
    readonly id: string
    /** The stored channel value. */
    readonly channel: string
    /** The stored visitor name value. */
    readonly visitor_name: string | null
    /** The stored lead id value. */
    readonly lead_id: string | null
    /** The stored handled by value. */
    readonly handled_by: string | null
    /** The stored handled at value. */
    readonly handled_at: Date | string | null
    /** The stored external id value. */
    readonly external_id: string | null
    /** The stored created at value. */
    readonly created_at: Date | string
}

/** The message columns contributing to activity figures. */
export interface MessageBriefRow {
    /** The stored id value. */
    readonly id: string
    /** The stored conversation id value. */
    readonly conversation_id: string
    /** The stored role value. */
    readonly role: string
    /** The stored body value. */
    readonly body: string
    /** The stored created at value. */
    readonly created_at: Date | string
}

/** The stored message columns shown in a thread. */
export interface MessageRow extends MessageBriefRow {
    /** The stored author kind value. */
    readonly author_kind: string | null
    /** The stored author name value. */
    readonly author_name: string | null
    /** The stored delivery status value. */
    readonly delivery_status: string | null
    /** The stored delivery error value. */
    readonly delivery_error: string | null
}

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

/** The lead name and capture time. */
export interface LeadBriefRow {
    /** The stored id value. */
    readonly id: string
    /** The stored contact name value. */
    readonly contact_name: string
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

/** The selected Chatbot agent id. */
export interface AgentIdRow {
    /** The stored id value. */
    readonly id: string
}

/** The selected staff display name. */
export interface ChatbotStaffRow {
    /** The stored name value. */
    readonly name: string
}

/** An active agent and its catalog module. */
export interface LensRow {
    /** The stored module value. */
    readonly module: string
    /** The stored name value. */
    readonly name: string
}
