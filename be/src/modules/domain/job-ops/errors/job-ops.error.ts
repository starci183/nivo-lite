import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the jobs operations capability. */
export enum JobOpsErrorCode {
    /** The requested tick is not a migration-owned scheduler id. */
    TickIdInvalid = "JOB_OPS_TICK_ID_INVALID",
    /** The requested row limit is not an integer from 1 through 200. */
    LimitInvalid = "JOB_OPS_LIMIT_INVALID",
    /** The requested time window is not an integer from 1 through 720 hours. */
    HoursInvalid = "JOB_OPS_HOURS_INVALID",
    /** The requested outbox identity is not a UUID. */
    IdInvalid = "JOB_OPS_ID_INVALID",
    /** An alert setting is malformed or outside its supported range. */
    AlertConfigInvalid = "JOB_OPS_ALERT_CONFIG_INVALID",
    /** Too many jobs failed in the last 24 hours. */
    FailedJobsAlert = "JOB_OPS_FAILED_JOBS_ALERT",
    /** The oldest queued job has waited longer than its allowed age. */
    JobsStaleAlert = "JOB_OPS_JOBS_STALE_ALERT",
}

/** How each jobs operations code travels. */
export const JOB_OPS_ERROR_KINDS: Record<JobOpsErrorCode, ErrorKind> = {
    [JobOpsErrorCode.TickIdInvalid]: "invalid",
    [JobOpsErrorCode.LimitInvalid]: "invalid",
    [JobOpsErrorCode.HoursInvalid]: "invalid",
    [JobOpsErrorCode.IdInvalid]: "invalid",
    [JobOpsErrorCode.AlertConfigInvalid]: "internal",
    [JobOpsErrorCode.FailedJobsAlert]: "internal",
    [JobOpsErrorCode.JobsStaleAlert]: "internal",
}

/** The one error class of the jobs operations capability. */
export class JobOpsError extends DomainError<JobOpsErrorCode> {}
