/** Log events of the thread runs: ids, codes and counts only, never the words of a customer or a founder. */
export enum AgentThreadsLogEvent {
    /** A run started on a thread, or a wake that was tried again continued it. */
    ThreadDriven = "agent_threads.thread_driven",
    /** A node threw something that is no domain error (a programming fault): logged with its stack, for developers only. */
    StepThrew = "agent_threads.step_threw",
    /** A thread stopped for a person. */
    ThreadStopped = "agent_threads.thread_stopped",
    /** A thread ended (its outcome is the run's projection), so the end hooks ran. */
    ThreadEnded = "agent_threads.thread_ended",
    /** A founder's decision, or a re-drive, was written as a wake of the run's scope. */
    WakeAdmitted = "agent_threads.wake_admitted",
    WaitHandedBack = "agent_threads.wait_handed_back",
    /** A decision or a re-drive was refused before any wake was written (`code`). */
    WakeRefused = "agent_threads.wake_refused",
    /**
     * A person's recorded decision reached a thread that no longer waits on that stop as it stood when the decision was recorded (`runId`,
     * `stepKey`, `kind`, `by`): it was not applied (the stop resolved, or the thread moved on), and the wake only drove the thread as it stood.
     */
    DecisionStale = "agent_threads.decision_stale",
    /** A wake of a thread found nothing to move (`code`). */
    WakeSkipped = "agent_threads.wake_skipped",
    /** A second driver asked for a thread that is being driven; it ran nothing. */
    ThreadBusy = "agent_threads.thread_busy",
    /** The driver's lease was taken over: the saver refused its write and the drive stopped. */
    ThreadFenced = "agent_threads.thread_fenced",
    /** The pinned version of a run does not compile; the run ended as failed. */
    TemplateRefused = "agent_threads.template_refused",
    /** A projection write was refused; the rows only show, so the thread went on. */
    ProjectionRefused = "agent_threads.projection_refused",
    /** The channel refused the AI core's line for the customer of a stop (`stepKey`); the team already has the card. */
    CustomerLineRefused = "agent_threads.customer_line_refused",
    /**
     * A step failed while a member of the shop holds the run's route (ruling R45): the run ended `skipped` with code `route_held`, no stop
     * card and no lead freeze (`runId`, `stepKey`, `code`, `routeId`). The hand-back's resume event answers the person.
     */
    RouteHeldEnded = "agent_threads.route_held_ended",
    /** A read a stop only adds to failed (`read`: given, memory, workflow_name, lead); the stop goes on without it. */
    StepReadFailed = "agent_threads.step_read_failed",
    /** The work engine refused to withdraw an approval stop's item (decided meanwhile, or gone); the stop no longer waits on it. */
    StopItemKept = "agent_threads.stop_item_kept",
    /** A person took over a stop that waited for a permission request: the request was declined by them through the work engine (`runId`, `stepKey`, `workItemId`, `memberId`). */
    ApprovalDeclinedByTakeOver = "agent_threads.approval_declined_by_take_over",
    /** A route was handed back to the agents: the stops a person took over on it were ended (`routeId`, `stops` found, `ended` admitted). */
    TakeOverHandedBack = "agent_threads.take_over_handed_back",
    /** A listener told of a stopped thread failed (`stepKey`); the wake still ended well. */
    StopListenerFailed = "agent_threads.stop_listener_failed",
    /** A deadline was armed for a stop (`stepKey`, `dueAt`). */
    DeadlineArmed = "agent_threads.deadline_armed",
    /** A deadline came and answered its stop `timeout` (`stepKey`). */
    DeadlineFired = "agent_threads.deadline_fired",
    /** A deadline came for a stop that no longer stands as it was armed for (`code`): it did nothing. */
    DeadlineSkipped = "agent_threads.deadline_skipped",
    /** One item of the thread sweep failed (`kind`); the rest went on. */
    SweepItemFailed = "agent_threads.sweep_item_failed",
    /** A thread whose drive was cut and that nobody drives was written a re-drive. */
    ThreadRedriven = "agent_threads.thread_redriven",
    /** The run and step rows of a thread were written again from its state (`code`). */
    ProjectionRepaired = "agent_threads.projection_repaired",
    /** A run whose thread cannot go on was closed as failed by the sweep (`code`). */
    ThreadAbandoned = "agent_threads.thread_abandoned",
    /** A run parked on an erased subject was ended (`subject_erased`), with the count of wakes held behind it that were dropped. */
    SubjectErasedRunEnded = "agent_threads.subject_erased_run_ended",
    /** One pass of the thread sweep ended, with its counts. */
    SweepDone = "agent_threads.sweep_done",
    /** A reply in the team chat to the card of a stop was handed to the stop door (`runId`, `outcome`); never the reply's words. */
    AnsweredInChat = "agent_threads.answered_in_chat",
}
