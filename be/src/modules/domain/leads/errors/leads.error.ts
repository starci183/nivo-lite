import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the leads capability. */
export enum LeadsErrorCode {
    /** No lead of the workspace has the requested id. */
    NotFound = "LEADS_NOT_FOUND",
}

/** How each leads code travels. */
export const LEADS_ERROR_KINDS: Record<LeadsErrorCode, ErrorKind> = {
    [LeadsErrorCode.NotFound]: "not-found",
}

/** The one error class of the leads capability. */
export class LeadsError extends DomainError<LeadsErrorCode> {}
