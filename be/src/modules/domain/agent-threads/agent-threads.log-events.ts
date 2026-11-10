/** Log events of the thread runs: ids, codes and counts only, never the words of a customer or a founder. */
export enum AgentThreadsLogEvent {
    /** A run started on a thread, or a wake that was tried again continued it. */
    ThreadDriven = "agent_threads.thread_driven",
    /** A thread stopped for a person. */
    ThreadStopped = "agent_threads.thread_stopped",
    /** A thread ended. */
    ThreadEnded = "agent_threads.thread_ended",
    /** A founder's decision, or a re-drive, was written as a wake of the run's scope. */
    WakeAdmitted = "agent_threads.wake_admitted",
    /** A decision or a re-drive was refused before any wake was written (`code`). */
    WakeRefused = "agent_threads.wake_refused",
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
    /** One pass of the thread sweep ended, with its counts. */
    SweepDone = "agent_threads.sweep_done",
}
