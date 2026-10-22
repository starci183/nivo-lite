import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the work-threads capability. */
export enum WorkThreadsErrorCode {
    /** No thread of the workspace has the requested id. */
    ThreadNotFound = "WORK_THREADS_THREAD_NOT_FOUND",
    /** The lead the thread should be about is not in the workspace. */
    LeadNotFound = "WORK_THREADS_LEAD_NOT_FOUND",
    /** The order the thread should be about is not in the workspace. */
    OrderNotFound = "WORK_THREADS_ORDER_NOT_FOUND",
    /** The insert answered no row: the thread was not written. */
    NotStored = "WORK_THREADS_NOT_STORED",
}

/** How each work-threads code travels. */
export const WORK_THREADS_ERROR_KINDS: Record<WorkThreadsErrorCode, ErrorKind> = {
    [WorkThreadsErrorCode.ThreadNotFound]: "not-found",
    [WorkThreadsErrorCode.LeadNotFound]: "not-found",
    [WorkThreadsErrorCode.OrderNotFound]: "not-found",
    [WorkThreadsErrorCode.NotStored]: "internal",
}

/** The one error class of the work-threads capability. */
export class WorkThreadsError extends DomainError<WorkThreadsErrorCode> {}
