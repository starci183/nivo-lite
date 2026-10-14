import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectErrorReporter } from "@modules/platform/errors"
import type { ErrorReporter } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { startLocalInterval } from "@modules/platform/queue"
import type { LocalTimer } from "@modules/platform/queue"
import { JobOpsError, JobOpsErrorCode } from "./errors/job-ops.error"
import type { JobStats, JobStatsResult } from "./job-ops.contracts"
import { InjectJobOpsOptions } from "./job-ops.decorators"
import { JobOpsLogEvent } from "./job-ops.log-events"
import type { JobOpsOptions, JobsAlertOptions } from "./job-ops.options"
import { JobOpsService } from "./job-ops.service"

const ALERT_COOLDOWN_MS = 30 * 60 * 1000
type JobAlertKind = "failed-jobs" | "jobs-stale"

@Injectable()
/** Reads queue statistics on its own timer, so stalled queue consumers cannot suppress operational alerts. */
export class JobOpsAlertMonitorService implements OnApplicationBootstrap, OnApplicationShutdown {
    private timer: LocalTimer | undefined
    private running: Promise<void> | undefined
    private stopped = false
    private readonly alertedAt = new Map<JobAlertKind, number>()

    constructor(
        @InjectJobOpsOptions() private readonly options: JobOpsOptions,
        private readonly jobs: JobOpsService,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectErrorReporter() private readonly reporter: ErrorReporter,
    ) {}

    /** Starts the independent monitor only for an app with an enabled queue consumer. */
    onApplicationBootstrap(): void {
        const alerts = this.options.alerts
        if (alerts?.enabled !== true || this.timer !== undefined) return
        this.stopped = false
        this.timer = startLocalInterval(alerts.intervalMs, () => this.startCheck())
    }

    /** Stops new checks and lets any current statistics read and reports settle before shutdown. */
    async onApplicationShutdown(): Promise<void> {
        this.stopped = true
        this.timer?.cancel()
        this.timer = undefined
        await this.running
    }

    /** Allows only one check in flight and accounts for an unexpected failure at the timer boundary. */
    private startCheck(): void {
        if (this.running !== undefined || this.stopped) return
        this.running = this.check()
            .catch((cause: unknown) => {
                this.logger.error(JobOpsLogEvent.AlertMonitorFailed, cause)
            })
            .finally(() => {
                this.running = undefined
            })
    }

    /** Checks both counters; unavailable statistics warn without creating alerts or consuming cooldowns. */
    private async check(): Promise<void> {
        const alerts = this.options.alerts
        if (alerts?.enabled !== true) return
        let stats: JobStatsResult
        try {
            stats = await this.jobs.stats()
        } catch {
            this.logger.warn(JobOpsLogEvent.AlertUnavailable, { reason: "stats-error" })
            return
        }
        if (this.stopped) return
        if (stats === null) {
            this.logger.warn(JobOpsLogEvent.AlertUnavailable, { reason: "stats-unavailable" })
            return
        }
        const now = this.clock.now().getTime()
        await Promise.all([
            stats.failed24h > alerts.failedMax ? this.alert("failed-jobs", stats, alerts, now) : Promise.resolve(),
            stats.oldestQueuedAgeSeconds > alerts.staleSeconds
                ? this.alert("jobs-stale", stats, alerts, now)
                : Promise.resolve(),
        ])
    }

    /** Emits and records one alert per kind in each cooldown window, using only counters and configured limits. */
    private alert(kind: JobAlertKind, stats: JobStats, alerts: JobsAlertOptions, now: number): Promise<void> {
        const previous = this.alertedAt.get(kind)
        if (previous !== undefined && now - previous < ALERT_COOLDOWN_MS) return Promise.resolve()
        this.alertedAt.set(kind, now)
        const fields = {
            kind,
            failed24h: stats.failed24h,
            oldestQueuedAgeSeconds: stats.oldestQueuedAgeSeconds,
            failedMax: alerts.failedMax,
            staleSeconds: alerts.staleSeconds,
        }
        const error = new JobOpsError({
            code: kind === "failed-jobs" ? JobOpsErrorCode.FailedJobsAlert : JobOpsErrorCode.JobsStaleAlert,
        })
        this.logger.error(
            kind === "failed-jobs" ? JobOpsLogEvent.AlertFailedJobs : JobOpsLogEvent.AlertJobsStale,
            error,
            fields,
        )
        return this.reporter.report("jobs.alert", error, fields)
    }
}
