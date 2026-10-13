import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the executions capability. */
export enum ExecutionsErrorCode {
    /** The insert answered no row: the approval card was not written. */
    NotCreated = "EXECUTIONS_NOT_CREATED",
}

/** How each executions code travels. */
export const EXECUTIONS_ERROR_KINDS: Record<ExecutionsErrorCode, ErrorKind> = {
    [ExecutionsErrorCode.NotCreated]: "internal",
}

/** The one error class of the executions capability. */
export class ExecutionsError extends DomainError<ExecutionsErrorCode> {}
