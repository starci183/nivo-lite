/** Log events of the Meta inbox: ids and reasons only, never the words of a customer. */
export enum MetaInboxLogEvent {
    /**
     * A queued event's account was removed (or never connected) between the receipt and the delivery: nothing is delivered, the kept raw
     * `meta.event` row stays as the evidence, and the job ends with the typed outcome `account_removed`.
     */
    AccountRemoved = "meta_inbox.account_removed",
}
