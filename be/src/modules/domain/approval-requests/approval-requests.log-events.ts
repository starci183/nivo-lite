/** Log events of the approval requests. */
export enum ApprovalLogEvent {
    /** A settled request could not be announced to the work chain; the request stands settled. */
    ResolvedEventFailed = "approvals.resolved_event_failed",
    /** A reminder could not be announced; the request is marked reminded all the same and is not reminded again. */
    ReminderEventFailed = "approvals.reminder_event_failed",
    /** The owner of an agent could not be read; the request falls to the workspace owner. */
    OwnerUnreadable = "approvals.owner_unreadable",
}
