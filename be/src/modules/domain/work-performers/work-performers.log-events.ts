/** Log events of the work-performers capability. */
export enum WorkPerformersLogEvent {
    /** The payment instructions could not be sent; the invoice stands. */
    InstructionsFailed = "work_performers.instructions_failed",
    /** The references of a customer email could not be read; the email goes without them. */
    RefsUnreadable = "work_performers.refs_unreadable",
    /** The member could not be told about a redeemed reward in the chat; the redemption stands. */
    RedeemNoticeFailed = "work_performers.redeem_notice_failed",
    /** A booking reminder could not be sent; its row is marked failed. */
    ReminderFailed = "work_performers.reminder_failed",
    /** The model could not write the thank-you after a payment; the filled template goes through the gate instead. */
    CareDraftFallback = "work_performers.care_draft_fallback",
    /** The judge of the order reconciliation answered in a shape the schema does not read; the case goes to a person. */
    JudgementUnreadable = "work_performers.judgement_unreadable",
    /** A customer could not be told their payment was received; the order stays paid. */
    PaymentConfirmationFailed = "work_performers.payment_confirmation_failed",
}
