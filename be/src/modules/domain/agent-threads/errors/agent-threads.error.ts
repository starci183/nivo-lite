import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the thread runs: every way a drive is refused by name instead of doing nothing. */
export enum AgentThreadsErrorCode {
    /** The app composed the thread runs but no threads port (the LangGraph integration is not composed): no run could be driven. */
    PortMissing = "AGENT_THREADS_PORT_MISSING",
    /** The thread is already being driven; this driver ran nothing and its wake is tried again (`runId`). */
    Busy = "AGENT_THREADS_BUSY",
    /** The driver's lease was lost before the drive began; nothing ran (`runId`). */
    LeaseLost = "AGENT_THREADS_LEASE_LOST",
    /** The thread has no checkpoint although its run was admitted as a thread (`runId`). */
    ThreadAbsent = "AGENT_THREADS_THREAD_ABSENT",
    /** The version a run is pinned to does not compile into a thread graph (`version`, `problem`, `at`). */
    TemplateRefused = "AGENT_THREADS_TEMPLATE_REFUSED",
    /** The run row could not be marked as a thread's when it was opened, so no thread was started (`runId`). */
    RunUnmarked = "AGENT_THREADS_RUN_UNMARKED",
    /** A node ran for a run this process is not driving (`runId`): the engine's own bug, never a business state. */
    NotDriving = "AGENT_THREADS_NOT_DRIVING",
}

/** How each code travels. */
export const AGENT_THREADS_ERROR_KINDS: Record<AgentThreadsErrorCode, ErrorKind> = {
    [AgentThreadsErrorCode.PortMissing]: "internal",
    [AgentThreadsErrorCode.Busy]: "conflict",
    [AgentThreadsErrorCode.LeaseLost]: "conflict",
    [AgentThreadsErrorCode.ThreadAbsent]: "internal",
    [AgentThreadsErrorCode.TemplateRefused]: "internal",
    [AgentThreadsErrorCode.RunUnmarked]: "internal",
    [AgentThreadsErrorCode.NotDriving]: "internal",
}

/** The typed error of the thread runs. */
export class AgentThreadsError extends DomainError<AgentThreadsErrorCode> {}
