/** Log events of the sales effects: ids and counts only, never a customer's words. */
export enum SalesEffectsLogEvent {
    /** The payment timers of a settled or cancelled order could not be closed; the reminder's own guard covers it. */
    PaymentTimersCloseFailed = "sales_effects.payment_timers_close_failed",
}
