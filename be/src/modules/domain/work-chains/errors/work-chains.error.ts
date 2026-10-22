import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the work-chains capability. */
export enum WorkChainsErrorCode {
    /** No thread of the workspace has the requested id. */
    ThreadNotFound = "WORK_CHAINS_THREAD_NOT_FOUND",
    /** The insert answered no row: the step was not written. */
    NotStored = "WORK_CHAINS_NOT_STORED",
}

/** How each work-chains code travels. */
export const WORK_CHAINS_ERROR_KINDS: Record<WorkChainsErrorCode, ErrorKind> = {
    [WorkChainsErrorCode.ThreadNotFound]: "not-found",
    [WorkChainsErrorCode.NotStored]: "internal",
}

/** The one error class of the work-chains capability. */
export class WorkChainsError extends DomainError<WorkChainsErrorCode> {}
