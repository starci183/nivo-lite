import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-runs capability. */
export enum AgentRunsErrorCode {
    /** A record answered something the capability cannot read, or a write the engine refused. */
    ResultRejected = "AGENT_RUNS_RESULT_REJECTED",
    /** The run changed under every try of a write: the caller tries again. */
    RunContended = "AGENT_RUNS_RUN_CONTENDED",
}

/** How each agent-runs code travels. */
export const AGENT_RUNS_ERROR_KINDS: Record<AgentRunsErrorCode, ErrorKind> = {
    [AgentRunsErrorCode.ResultRejected]: "internal",
    [AgentRunsErrorCode.RunContended]: "unavailable",
}

/** The one error class of the agent-runs capability. */
export class AgentRunsError extends DomainError<AgentRunsErrorCode> {}
