/** Log events of the work engine and the command bus. */
export enum WorkEngineLogEvent {
    /** A notification following a committed human decision failed; the decision stays closed. */
    ClosedNotificationFailed = "decisions.closed_notification_failed",
    /** The closed-item hook threw; the decision stands and whoever waits recovers from the item. */
    ClosedHookFailed = "decisions.closed_hook_failed",
    /** A failed item could not be marked failed; the in-memory failure is reported instead. */
    MarkFailedFailed = "decisions.mark_failed_failed",
    /** A line of the evidence log could not be written; the work goes on. */
    EvidenceFailed = "decisions.evidence_failed",
    /** A line of the Office thread could not be written; the work goes on. */
    OfficeFailed = "decisions.office_failed",
    /** The status of an inbound event could not be set; the work goes on. */
    InboundStatusFailed = "decisions.inbound_status_failed",
    /** The receiving instance of a command could not be resolved; the database trigger still attributes the item. */
    InstanceUnresolved = "decisions.instance_unresolved",
}
