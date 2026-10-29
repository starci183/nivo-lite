/** Log events of the approval requests. */
export enum ApprovalLogEvent {
    /** A reminder could not be announced; the request is marked reminded all the same and is not reminded again. */
    ReminderEventFailed = "approvals.reminder_event_failed",
    /** The owner of an agent could not be read; the request falls to the workspace owner. */
    OwnerUnreadable = "approvals.owner_unreadable",
}
