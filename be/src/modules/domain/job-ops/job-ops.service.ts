import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { JobOpsError, JobOpsErrorCode } from "./errors/job-ops.error"
import type {
    FailedJob,
    JobRequeueResult,
    JobsWatchdogResult,
    JobStatsResult,
    OpenJob,
    RetryFailedResult,
} from "./job-ops.contracts"
import { JobOpsLogEvent } from "./job-ops.log-events"
import type {
    FailedJobRow,
    JobRequeueFailedRow,
    JobRequeueRow,
    JobStatsRow,
    OpenJobRow,
} from "./persistence/job-ops.rows"

const LIMIT_MAX = 200
const HOURS_MAX = 720
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$(?![\s\S])/i

const requireInteger = (value: number, maximum: number, code: JobOpsErrorCode): void => {
    if (!Number.isInteger(value) || value < 1 || value > maximum) throw new JobOpsError({ code })
}

@Injectable()
/** Runs operator jobs operations through the primary app_be connection and its existing grants. */
export class JobOpsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Returns the existing database function's JSON statistics without reshaping them. */
    async stats(): Promise<JobStatsResult> {
        const [row] = await callDbFunction<JobStatsRow>(this.entityManager, "public.job_stats", [])
        return row?.job_stats ?? null
    }

    /** Returns failed jobs through the database function granted to the primary role. */
    async failed(limit: number): Promise<ReadonlyArray<FailedJob>> {
        requireInteger(limit, LIMIT_MAX, JobOpsErrorCode.LimitInvalid)
        const rows = await callDbFunction<FailedJobRow>(this.entityManager, "public.job_failed", [limit])
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            attempts: row.attempts,
            finished_at: row.finished_at === null ? null : new Date(row.finished_at).toISOString(),
            last_error: row.last_error,
        }))
    }

    /** Returns queued and running jobs through the database function granted to the primary role. */
    async open(limit: number): Promise<ReadonlyArray<OpenJob>> {
        requireInteger(limit, LIMIT_MAX, JobOpsErrorCode.LimitInvalid)
        const rows = await callDbFunction<OpenJobRow>(this.entityManager, "public.job_open", [limit])
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            state: row.state,
            attempts: row.attempts,
            created_at: new Date(row.created_at).toISOString(),
            last_error: row.last_error,
        }))
    }

    /** Sends one failed job again, returning the new lossless message id or null. */
    async requeue(outboxId: string): Promise<JobRequeueResult> {
        if (!UUID_PATTERN.test(outboxId)) throw new JobOpsError({ code: JobOpsErrorCode.IdInvalid })
        const [row] = await callDbFunction<JobRequeueRow>(this.entityManager, "public.job_reopen", [outboxId])
        return row?.job_reopen ?? null
    }

    /** Requeues failed jobs in the requested time window through the granted database function. */
    async requeueFailed(hours: number): Promise<RetryFailedResult> {
        requireInteger(hours, HOURS_MAX, JobOpsErrorCode.HoursInvalid)
        const [row] = await callDbFunction<JobRequeueFailedRow>(this.entityManager, "public.job_requeue_failed", [
            hours,
        ])
        return { requeued: row?.job_requeue_failed.requeued ?? 0, failed: row?.job_requeue_failed.failed ?? 0 }
    }

    /** Returns the watchdog counters, or -1 for both when no checked statistics are available. */
    async watchdog(): Promise<JobsWatchdogResult> {
        try {
            const stats = await this.stats()
            if (stats?.checkedAt) {
                return { failed24h: stats.failed24h, oldestQueuedAgeSeconds: stats.oldestQueuedAgeSeconds }
            }
        } catch (error) {
            this.logger.error(JobOpsLogEvent.WatchdogUnavailable, error)
            return { failed24h: -1, oldestQueuedAgeSeconds: -1 }
        }
        return { failed24h: -1, oldestQueuedAgeSeconds: -1 }
    }
}
