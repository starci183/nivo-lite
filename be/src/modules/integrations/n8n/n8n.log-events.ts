/** Log events of the n8n integration. */
export enum N8nLogEvent {
    /** One target did not accept an event; the retry decision follows from the results. */
    TargetFailed = "n8n.target_failed",
}
