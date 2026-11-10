/** Log events of the freezes of customers: ids, codes and counts only, never the words of a customer. */
export enum LeadFreezesLogEvent {
    /** A run failed for good and froze its customer (a new episode, or its retry failed again). */
    Frozen = "lead_freezes.frozen",
    /** A wake of a frozen customer started no run; it waits as a pending event. */
    EventHeld = "lead_freezes.event_held",
    /** The owner asked to retry the failed run. */
    RetryStarted = "lead_freezes.retry_started",
    /** The customer was released and the pending events written again as wakes. */
    Released = "lead_freezes.released",
    /** A retried run ended but its freeze could not be settled then; the next read settles it. */
    SettleFailed = "lead_freezes.settle_failed",
    /** The owner took the conversation over. */
    TakenOver = "lead_freezes.taken_over",
    /** Another run of a customer already frozen stopped; it is held for the owner, the freeze keeps its own run. */
    OtherRunStopped = "lead_freezes.other_run_stopped",
    /** The title of a failed step could not be read from its graph; the item names the step by its key. */
    StepTitleUnread = "lead_freezes.step_title_unread",
    /** A person replied in the team chat to the report of a stuck step: the freeze was answered as a retry, or they may not decide. */
    AnsweredInChat = "lead_freezes.answered_in_chat",
}
