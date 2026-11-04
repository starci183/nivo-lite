/** Log events of the agent runs: ids and codes only, never the words of a customer or a colleague. */
export enum AgentRunsLogEvent {
    /** A step's commit found its fence moved on, so it changed nothing. */
    StepFenced = "agent_runs.step_fenced",
    /** A handler threw; the step is tried again or given up. */
    HandlerThrew = "agent_runs.handler_threw",
    /** A step kind had no handler registered. */
    NoHandler = "agent_runs.no_handler",
    /** A step will be tried again after its backoff. */
    StepRetry = "agent_runs.step_retry",
    /** A step was given up and the run routed. */
    StepFailed = "agent_runs.step_failed",
    /** An undo threw or had no handler; it is tried again, and past its tries the run goes to a person. */
    CompensationFailed = "agent_runs.compensation_failed",
    /** A person was told a run stopped. */
    DeadLettered = "agent_runs.dead_lettered",
    /** A run stopped and no handler could tell a person. */
    DeadWithoutVoice = "agent_runs.dead_without_voice",
    /** The dead letter of a run threw; the sweep tries again. */
    DeadLetterFailed = "agent_runs.dead_letter_failed",
    /** One thing the sweep looked at failed; the rest of the pass went on. */
    SweepItemFailed = "agent_runs.sweep_item_failed",
    /** A claim could not be given back at shutdown; the sweep takes the step when the claim runs out. */
    ReleaseFailed = "agent_runs.release_failed",
    /** A wait past its deadline was handed to the graph's timeout. */
    WaitExpired = "agent_runs.wait_expired",
    /** A parked run was put back on its failed step. */
    RunResumed = "agent_runs.run_resumed",
    /** A run parked on a step that waits for a fix. */
    RunParked = "agent_runs.run_parked",
    /** A pass over the parked runs failed on one run; the rest went on. */
    ResumeFailed = "agent_runs.resume_failed",
}
