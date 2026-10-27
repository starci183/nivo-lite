/** Log events of the work-performers capability. */
export enum WorkPerformersLogEvent {
    /** The payment instructions could not be sent; the invoice stands. */
    InstructionsFailed = "work_performers.instructions_failed",
    /** The references of a customer email could not be read; the email goes without them. */
    RefsUnreadable = "work_performers.refs_unreadable",
    /** The member could not be told about a redeemed reward in the chat; the redemption stands. */
    RedeemNoticeFailed = "work_performers.redeem_notice_failed",
    /** A paid renewal invoice could not move its contract to the next term; the payment stands. */
    ContractRenewalFailed = "work_performers.contract_renewal_failed",
    /** A booking reminder could not be sent; its row is marked failed. */
    ReminderFailed = "work_performers.reminder_failed",
}
