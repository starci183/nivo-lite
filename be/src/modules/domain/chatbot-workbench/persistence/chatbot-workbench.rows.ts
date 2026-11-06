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

/** A Chatbot installation and its agent binding. */
export interface ChatbotInstallationRow {
    /** The stored id value. */
    readonly id: string
    /** The stored agent id value. */
    readonly agent_id: string | null
}
