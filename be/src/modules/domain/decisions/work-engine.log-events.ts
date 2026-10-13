/** Log events of the work engine and the command bus. */
export enum WorkEngineLogEvent {
    /** A failed item could not be marked failed; the in-memory failure is reported instead. */
    MarkFailedFailed = "decisions.mark_failed_failed",
    /** A line of the evidence log could not be written; the work goes on. */
    EvidenceFailed = "decisions.evidence_failed",
    /** A line of the Office thread could not be written; the work goes on. */
    OfficeFailed = "decisions.office_failed",
    /** The status of an inbound event could not be set; the work goes on. */
    InboundStatusFailed = "decisions.inbound_status_failed",
    /** The `decision.made` event could not be published; the decision stands. */
    DecisionEventFailed = "decisions.decision_event_failed",
    /** A command subject label could not be read; the Office line goes without it. */
    SubjectLabelUnreadable = "decisions.subject_label_unreadable",
    /** The receiving instance of a command could not be resolved; the database trigger still attributes the item. */
    InstanceUnresolved = "decisions.instance_unresolved",
}
