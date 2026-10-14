import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the jobs operations capability. */
export enum JobOpsErrorCode {
    /** The requested row limit is not an integer from 1 through 200. */
    LimitInvalid = "JOB_OPS_LIMIT_INVALID",
    /** The requested time window is not an integer from 1 through 720 hours. */
    HoursInvalid = "JOB_OPS_HOURS_INVALID",
    /** The requested outbox identity is not a UUID. */
    IdInvalid = "JOB_OPS_ID_INVALID",
}

/** How each jobs operations code travels. */
export const JOB_OPS_ERROR_KINDS: Record<JobOpsErrorCode, ErrorKind> = {
    [JobOpsErrorCode.LimitInvalid]: "invalid",
    [JobOpsErrorCode.HoursInvalid]: "invalid",
    [JobOpsErrorCode.IdInvalid]: "invalid",
}

/** The one error class of the jobs operations capability. */
export class JobOpsError extends DomainError<JobOpsErrorCode> {}
