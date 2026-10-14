import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { ERROR_REPORTER } from "@modules/platform/errors"
import type { ErrorReporter } from "@modules/platform/errors"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { JobOpsError, JobOpsErrorCode } from "./errors/job-ops.error"
import { JobOpsAlertMonitorService } from "./job-ops-alert-monitor.service"
import type { JobStats, JobStatsResult } from "./job-ops.contracts"
import { JOB_OPS_OPTIONS } from "./job-ops.decorators"
import { JobOpsLogEvent } from "./job-ops.log-events"
import type { JobOpsOptions } from "./job-ops.options"
import { JobOpsService } from "./job-ops.service"

const INTERVAL_MS = 300_000
const OPTIONS: JobOpsOptions = {
    alerts: { enabled: true, intervalMs: INTERVAL_MS, failedMax: 20, staleSeconds: 300 },
}
const STATS: JobStats = {
    queues: {},
    running: 0,
    failed24h: 0,
    oldestQueuedAgeSeconds: 0,
    checkedAt: "2026-10-14T00:00:00.000Z",
}
const OVER_LIMITS: JobStats = { ...STATS, failed24h: 21, oldestQueuedAgeSeconds: 301 }

const build = async (options: JobOpsOptions = OPTIONS) => {
    const clock = new FakeClock("2026-10-14T00:00:00.000Z")
    const jobs = mock<JobOpsService>()
    jobs.stats.mockResolvedValue(STATS)
    const logger = mock<Logger>()
    const reporter = mock<ErrorReporter>()
    reporter.report.mockResolvedValue()
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobOpsAlertMonitorService,
            { provide: JOB_OPS_OPTIONS, useValue: { ...options } },
            { provide: JobOpsService, useValue: jobs },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: ERROR_REPORTER, useValue: reporter },
        ],
    }).compile()
    return { service: moduleRef.get(JobOpsAlertMonitorService), clock, jobs, logger, reporter }
}

describe("JobOpsAlertMonitorService", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    describe("onApplicationBootstrap", () => {
        it.each([{}, { alerts: { enabled: false, intervalMs: INTERVAL_MS, failedMax: 20, staleSeconds: 300 } }])(
            "does not start a timer when alerts are disabled or omitted: %j",
            async (options) => {
                const { service, jobs, logger, reporter } = await build(options)

                service.onApplicationBootstrap()
                await jest.advanceTimersByTimeAsync(INTERVAL_MS)

                expect(jest.getTimerCount()).toBe(0)
                expect(jobs.stats).not.toHaveBeenCalled()
                expect(logger.error).not.toHaveBeenCalled()
                expect(reporter.report).not.toHaveBeenCalled()
            },
        )

        it("starts just one timer when bootstrap is called twice", async () => {
            const { service, jobs } = await build()

            service.onApplicationBootstrap()
            service.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)

            expect(jest.getTimerCount()).toBe(1)
            expect(jobs.stats).toHaveBeenCalledTimes(1)
        })
    })

    describe("checks", () => {
        it.each([STATS, { ...STATS, failed24h: 20, oldestQueuedAgeSeconds: 300 }])(
            "does not alert when statistics are within or at the limits: %j",
            async (stats) => {
                const { service, jobs, logger, reporter } = await build()
                jobs.stats.mockResolvedValue(stats)

                service.onApplicationBootstrap()
                await jest.advanceTimersByTimeAsync(INTERVAL_MS)

                expect(jobs.stats).toHaveBeenCalledTimes(1)
                expect(logger.error).not.toHaveBeenCalled()
                expect(logger.warn).not.toHaveBeenCalled()
                expect(reporter.report).not.toHaveBeenCalled()
            },
        )

        it.each([
            [
                "failed-jobs",
                { ...STATS, failed24h: 21 },
                JobOpsLogEvent.AlertFailedJobs,
                JobOpsErrorCode.FailedJobsAlert,
            ],
            [
                "jobs-stale",
                { ...STATS, oldestQueuedAgeSeconds: 301 },
                JobOpsLogEvent.AlertJobsStale,
                JobOpsErrorCode.JobsStaleAlert,
            ],
        ] as const)("logs and reports one %s alert above its limit", async (kind, stats, event, code) => {
            const { service, jobs, logger, reporter } = await build()
            jobs.stats.mockResolvedValue(stats)
            const fields = {
                kind,
                failed24h: stats.failed24h,
                oldestQueuedAgeSeconds: stats.oldestQueuedAgeSeconds,
                failedMax: 20,
                staleSeconds: 300,
            }

            service.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)

            expect(logger.error).toHaveBeenCalledTimes(1)
            expect(logger.error).toHaveBeenCalledWith(event, expect.any(JobOpsError), fields)
            expect(reporter.report).toHaveBeenCalledTimes(1)
            expect(reporter.report).toHaveBeenCalledWith("jobs.alert", expect.objectContaining({ code }), fields)
            expect(reporter.report.mock.calls[0]?.[1]).toBe(logger.error.mock.calls[0]?.[1])
            expect(logger.warn).not.toHaveBeenCalled()
        })

        it("keeps a separate thirty-minute cooldown for each alert kind", async () => {
            const { service, clock, jobs, logger, reporter } = await build()
            jobs.stats.mockResolvedValue({ ...STATS, failed24h: 21 })
            service.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)

            clock.advance(10 * 60 * 1000)
            jobs.stats.mockResolvedValue(OVER_LIMITS)
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)
            expect(logger.error.mock.calls.map(([event]) => event)).toEqual([
                JobOpsLogEvent.AlertFailedJobs,
                JobOpsLogEvent.AlertJobsStale,
            ])

            clock.advance(20 * 60 * 1000 - 1)
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)
            expect(logger.error).toHaveBeenCalledTimes(2)
            expect(reporter.report).toHaveBeenCalledTimes(2)

            clock.advance(1)
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)
            expect(logger.error.mock.calls.map(([event]) => event)).toEqual([
                JobOpsLogEvent.AlertFailedJobs,
                JobOpsLogEvent.AlertJobsStale,
                JobOpsLogEvent.AlertFailedJobs,
            ])
            expect(reporter.report).toHaveBeenCalledTimes(3)

            clock.advance(10 * 60 * 1000)
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)
            expect(logger.error.mock.calls.map(([event]) => event)).toEqual([
                JobOpsLogEvent.AlertFailedJobs,
                JobOpsLogEvent.AlertJobsStale,
                JobOpsLogEvent.AlertFailedJobs,
                JobOpsLogEvent.AlertJobsStale,
            ])
            expect(reporter.report.mock.calls.map(([scope, , fields]) => [scope, fields?.kind])).toEqual([
                ["jobs.alert", "failed-jobs"],
                ["jobs.alert", "jobs-stale"],
                ["jobs.alert", "failed-jobs"],
                ["jobs.alert", "jobs-stale"],
            ])
        })

        it.each([
            ["stats-unavailable", () => Promise.resolve(null)],
            ["stats-error", () => Promise.reject(new Error("driver error with private details"))],
        ] as const)("only warns for %s and leaves both cooldowns available", async (reason, readStats) => {
            const { service, jobs, logger, reporter } = await build()
            jobs.stats.mockImplementationOnce(readStats)
            jobs.stats.mockResolvedValue(OVER_LIMITS)

            service.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)

            expect(logger.warn).toHaveBeenCalledTimes(1)
            expect(logger.warn).toHaveBeenCalledWith(JobOpsLogEvent.AlertUnavailable, { reason })
            expect(logger.error).not.toHaveBeenCalled()
            expect(reporter.report).not.toHaveBeenCalled()

            await jest.advanceTimersByTimeAsync(INTERVAL_MS)

            expect(logger.warn).toHaveBeenCalledTimes(1)
            expect(logger.error.mock.calls.map(([event]) => event)).toEqual([
                JobOpsLogEvent.AlertFailedJobs,
                JobOpsLogEvent.AlertJobsStale,
            ])
            expect(reporter.report).toHaveBeenCalledTimes(2)
        })
    })

    describe("onApplicationShutdown", () => {
        it("cancels future checks and waits for the running statistics read", async () => {
            const { service, jobs, logger, reporter } = await build()
            let finish: (stats: JobStatsResult) => void = () => undefined
            jobs.stats.mockImplementationOnce(
                () =>
                    new Promise<JobStatsResult>((resolve) => {
                        finish = resolve
                    }),
            )
            service.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(INTERVAL_MS * 2)
            expect(jobs.stats).toHaveBeenCalledTimes(1)
            const stopped = jest.fn()

            const closing = service.onApplicationShutdown().then(stopped)
            await Promise.resolve()

            expect(jest.getTimerCount()).toBe(0)
            expect(stopped).not.toHaveBeenCalled()
            finish(OVER_LIMITS)
            await closing
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)

            expect(stopped).toHaveBeenCalledTimes(1)
            expect(jobs.stats).toHaveBeenCalledTimes(1)
            expect(logger.error).not.toHaveBeenCalled()
            expect(reporter.report).not.toHaveBeenCalled()
        })

        it("waits for reports already started by a running check", async () => {
            const { service, jobs, reporter } = await build()
            jobs.stats.mockResolvedValue({ ...STATS, failed24h: 21 })
            let finish: () => void = () => undefined
            reporter.report.mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve
                    }),
            )
            service.onApplicationBootstrap()
            await jest.advanceTimersByTimeAsync(INTERVAL_MS)
            expect(reporter.report).toHaveBeenCalledTimes(1)
            const stopped = jest.fn()

            const closing = service.onApplicationShutdown().then(stopped)
            await Promise.resolve()

            expect(jest.getTimerCount()).toBe(0)
            expect(stopped).not.toHaveBeenCalled()
            finish()
            await closing

            expect(stopped).toHaveBeenCalledTimes(1)
        })
    })
})
