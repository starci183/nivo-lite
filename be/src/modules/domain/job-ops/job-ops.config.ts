import type { EnvSource } from "@modules/platform/config"
import { JobOpsError, JobOpsErrorCode } from "./errors/job-ops.error"
import type { JobsAlertOptions } from "./job-ops.options"

const TIMER_DELAY_MAX = 2_147_483_647
const INTEGER_PATTERN = /^[0-9]+$(?![\s\S])/u
const DURATION_PATTERN = /^[0-9]+(?:ms|s|m|h)?$(?![\s\S])/u

const requireValue = (value: number, key: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number => {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new JobOpsError({ code: JobOpsErrorCode.AlertConfigInvalid, params: { key } })
    }
    return value
}

const requireSyntax = (env: EnvSource, key: string, pattern: RegExp): void => {
    const value = env.optional(key)
    if (value !== undefined && !pattern.test(value)) {
        throw new JobOpsError({ code: JobOpsErrorCode.AlertConfigInvalid, params: { key } })
    }
}

/** Reads and bounds the alert tunables before any listener or background timer starts. */
export const parseJobsAlertConfig = (env: EnvSource): JobsAlertOptions => {
    requireSyntax(env, "JOBS_ALERT_INTERVAL", DURATION_PATTERN)
    requireSyntax(env, "JOBS_ALERT_FAILED_MAX", INTEGER_PATTERN)
    requireSyntax(env, "JOBS_ALERT_STALE_SECONDS", INTEGER_PATTERN)
    return {
        enabled: env.bool("QUEUE_ENABLED", true),
        intervalMs: requireValue(
            env.duration("JOBS_ALERT_INTERVAL", 300_000),
            "JOBS_ALERT_INTERVAL",
            1,
            TIMER_DELAY_MAX,
        ),
        failedMax: requireValue(env.int("JOBS_ALERT_FAILED_MAX", 20), "JOBS_ALERT_FAILED_MAX", 0),
        staleSeconds: requireValue(env.int("JOBS_ALERT_STALE_SECONDS", 300), "JOBS_ALERT_STALE_SECONDS", 0),
    }
}
