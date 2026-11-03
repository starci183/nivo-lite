/** Log events of the Zalo inbox reconcile run. */
export enum ZaloInboxLogEvent {
    /** A reconcile run finished; the counts ride in the fields. */
    PollDone = "zalo-inbox.poll.done",
    /** One connection could not be read back; the run went on with the next one. */
    PollFailed = "zalo-inbox.poll.failed",
    /** A connection was left out of the run; the reason rides in the fields. */
    PollSkipped = "zalo-inbox.poll.skipped",
    /** Customer messages were stored that the webhook had never delivered. */
    PollMissedByWebhook = "zalo-inbox.poll.missed-by-webhook",
}
