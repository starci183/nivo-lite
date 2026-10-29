/** The instant a customer last wrote in a conversation. */
export interface AutomationLastCustomerMessage {
    /** When it was written. */
    readonly created_at: string | Date
}

/** When the customer last wrote, or none. */
export type OptionalLastCustomerMessage = AutomationLastCustomerMessage | undefined
