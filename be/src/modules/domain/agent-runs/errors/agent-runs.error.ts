import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-runs capability. */
export enum AgentRunsErrorCode {
    /** A replay selected a different plan or tried to bind one after steps began. */
    PlanConflict = "AGENT_RUNS_PLAN_CONFLICT",
    /** A database function answered something the engine cannot read. */
    ResultRejected = "AGENT_RUNS_RESULT_REJECTED",
    /** Two handlers claim the same step kind. */
    HandlerDuplicate = "AGENT_RUNS_HANDLER_DUPLICATE",
    /** The wake has no running run to add a step to. */
    RunNotFound = "AGENT_RUNS_RUN_NOT_FOUND",
    /** A step called from inside a turn did not finish; the code says why. */
    StepFailed = "AGENT_RUNS_STEP_FAILED",
    /** An advance job names no run: nothing a retry could change. */
    JobPayloadInvalid = "AGENT_RUNS_JOB_PAYLOAD_INVALID",
    /** A step is held by its backoff: the job asks to run again after `params.seconds`, which is no failure. */
    StepDeferred = "AGENT_RUNS_STEP_DEFERRED",
}

/** How each agent-runs code travels. */
export const AGENT_RUNS_ERROR_KINDS: Record<AgentRunsErrorCode, ErrorKind> = {
    [AgentRunsErrorCode.PlanConflict]: "conflict",
    [AgentRunsErrorCode.ResultRejected]: "internal",
    [AgentRunsErrorCode.HandlerDuplicate]: "internal",
    [AgentRunsErrorCode.RunNotFound]: "not-found",
    [AgentRunsErrorCode.StepFailed]: "internal",
    [AgentRunsErrorCode.JobPayloadInvalid]: "internal",
    [AgentRunsErrorCode.StepDeferred]: "internal",
}

/** The one error class of the agent-runs capability. */
export class AgentRunsError extends DomainError<AgentRunsErrorCode> {}
