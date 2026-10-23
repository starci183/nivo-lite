import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the thread-work capability. */
export enum ThreadWorkErrorCode {
    /** The agent is not an active agent of the workspace. */
    AgentNotFound = "THREAD_WORK_AGENT_NOT_FOUND",
    /** The action is not one the agent's department performs. */
    ActionNotOfAgent = "THREAD_WORK_ACTION_NOT_OF_AGENT",
    /** The customer the work is about is not in the workspace. */
    LeadNotFound = "THREAD_WORK_LEAD_NOT_FOUND",
}

/** How each thread-work code travels. */
export const THREAD_WORK_ERROR_KINDS: Record<ThreadWorkErrorCode, ErrorKind> = {
    [ThreadWorkErrorCode.AgentNotFound]: "not-found",
    [ThreadWorkErrorCode.ActionNotOfAgent]: "invalid",
    [ThreadWorkErrorCode.LeadNotFound]: "not-found",
}

/** The one error class of the thread-work capability. */
export class ThreadWorkError extends DomainError<ThreadWorkErrorCode> {}
