/** The customer a thread is about. */
export interface ThreadLead {
    /** The thread id. */
    readonly id: string
    /** The customer, or null when the thread is about none. */
    readonly leadId: string | null
}
