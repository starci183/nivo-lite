import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { CLOCK } from "@modules/platform/clock"
import {
    POLL_MINUTE_MS,
    POLL_NOW,
    POLL_NOW_MS,
    pollConnectionRecordOf,
    pollScheduleRowOf,
    readPollPageOf,
} from "@tests/fixtures/builders/connection-poll.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { CONNECTION_POLL_OPTIONS, POLL_RANDOM } from "./connection-poll.decorators"
import type { PollRandom } from "./connection-poll.decorators"
import type { ConnectionPoller, PollFailure } from "./connection-poll.contracts"
import { ConnectionPollLogEvent } from "./connection-poll.log-events"
import { POLL_CURSOR_KEY } from "./connection-poll.policy"
import { ConnectionPollError, ConnectionPollErrorCode } from "./errors/connection-poll.error"
import { PollLimiterService } from "./poll-limiter.service"
import { PollOwnerNoticeService } from "./poll-owner-notice.service"
import type { DueConnection } from "./poll-schedule.service"
import { PollScheduleService } from "./poll-schedule.service"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"
import type { PollScheduleRow, PollSourceDirectory, ScheduledPollSource } from "./poll-schedule.contracts"
import { PollSchedulerService } from "./poll-scheduler.service"
import { PollSourceRegistryService } from "./poll-source-registry.service"

const NOW = POLL_NOW
const NOW_MS = POLL_NOW_MS
const MIN = POLL_MINUTE_MS
const limits = { ratePerSecond: 2, burst: 2, concurrency: 1 }

const dueOf = (over: Partial<PollScheduleRow> = {}, lagMs = 2000): DueConnection => ({
    row: pollScheduleRowOf(over),
    dueAt: new Date(NOW_MS - lagMs),
})

const build = async (
    classified: PollFailure = { kind: "transient" },
    directoryOf: (source: ScheduledPollSource) => PollSourceDirectory = (source) => ({
        providers: () => ["sepay"],
        sourceOf: (provider) => (provider === "sepay" ? source : undefined),
    }),
) => {
    const poller = mock<ConnectionPoller<unknown>>()
    poller.fetch.mockResolvedValue(readPollPageOf(2))
    poller.store.mockResolvedValue(true)
    const source: ScheduledPollSource = {
        provider: "sepay",
        limits,
        poller,
        classify: jest.fn().mockReturnValue(classified),
    }
    const directory = directoryOf(source)
    const random = mock<PollRandom>()
    random.next.mockReturnValue(0.5)
    const sources = mock<PollSourceRegistryService>()
    sources.providers.mockImplementation(() => directory.providers())
    sources.sourceOf.mockImplementation((provider) => directory.sourceOf(provider))
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(pollConnectionRecordOf())
    connections.get.mockResolvedValue(pollConnectionRecordOf())
    connections.patch.mockResolvedValue(undefined)
    const schedule = mock<PollScheduleService>()
    schedule.claimDue.mockResolvedValue([])
    const limiter = mock<PollLimiterService>()
    limiter.enter.mockResolvedValue({ release: jest.fn().mockResolvedValue(undefined) })
    limiter.pass.mockResolvedValue(undefined)
    const notice = mock<PollOwnerNoticeService>()
    const logger = mock<Logger>()
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback) => {
        callback()
        return () => undefined
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            PollSchedulerService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: TIMER, useValue: timer },
            { provide: POLL_RANDOM, useValue: random },
            { provide: CONNECTION_POLL_OPTIONS, useValue: { schedule: DEFAULT_POLL_SCHEDULE, redis: undefined } },
            { provide: ConnectionsService, useValue: connections },
            { provide: PollScheduleService, useValue: schedule },
            { provide: PollSourceRegistryService, useValue: sources },
            { provide: PollLimiterService, useValue: limiter },
            { provide: PollOwnerNoticeService, useValue: notice },
        ],
    }).compile()
    return {
        scheduler: moduleRef.get(PollSchedulerService),
        poller,
        source,
        connections,
        schedule,
        limiter,
        notice,
        logger,
    }
}

describe("PollSchedulerService tick picking", () => {
    it("does nothing when no provider can be polled", async () => {
        const { scheduler, schedule } = await build({ kind: "fatal" }, () => ({
            providers: () => [],
            sourceOf: () => undefined,
        }))

        await expect(scheduler.tick()).resolves.toEqual(new Map())

        expect(schedule.enroll).not.toHaveBeenCalled()
    })

    it("enrolls the providers and claims only a batch of what is due", async () => {
        const { scheduler, schedule } = await build()

        await scheduler.tick()

        expect(schedule.enroll).toHaveBeenCalledWith(["sepay"])
        expect(schedule.claimDue).toHaveBeenCalledWith(["sepay"], DEFAULT_POLL_SCHEDULE.batchSize)
    })

    it("polls the claimed connections one workspace after the other so none starves", async () => {
        const { scheduler, schedule, connections } = await build()
        schedule.claimDue.mockResolvedValue([
            dueOf({ connectionId: "a1", workspaceId: "a" }),
            dueOf({ connectionId: "a2", workspaceId: "a" }),
            dueOf({ connectionId: "b1", workspaceId: "b" }),
        ])

        await scheduler.tick()

        expect(connections.find.mock.calls.map(([, id]) => id)).toEqual(["a1", "b1", "a2"])
    })

    it("logs the metrics of each provider once per tick with the lag of the latest poll", async () => {
        const { scheduler, schedule, logger } = await build()
        schedule.claimDue.mockResolvedValue([dueOf({}, 4000), dueOf({ connectionId: "c-2" }, 9000)])

        const tallies = await scheduler.tick()

        expect(tallies.get("sepay")).toMatchObject({ polled: 2, found: 4, missedByWebhook: 4, maxLagMs: 9000 })
        expect(logger.info).toHaveBeenCalledWith(
            ConnectionPollLogEvent.Metrics,
            expect.objectContaining({ provider: "sepay", polled: 2, maxLagMs: 9000 }),
        )
    })
})

describe("PollSchedulerService connections that cannot be polled", () => {
    it.each([
        ["a connection that is gone", null],
        ["a disconnected connection", pollConnectionRecordOf({ status: "disconnected" })],
    ])("plans %s again at the healthy interval without polling it", async (_name, found) => {
        const { scheduler, schedule, connections, poller } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])
        connections.find.mockResolvedValue(found)

        await scheduler.tick()

        expect(poller.fetch).not.toHaveBeenCalled()
        expect(schedule.defer).toHaveBeenCalledWith("c-1", new Date(NOW_MS + 30 * MIN))
    })

    it("plans a connection whose provider has no source again without polling it", async () => {
        const { scheduler, schedule, poller } = await build()
        schedule.claimDue.mockResolvedValue([dueOf({ provider: "casso" })])

        await scheduler.tick()

        expect(poller.fetch).not.toHaveBeenCalled()
        expect(schedule.defer).toHaveBeenCalledTimes(1)
    })

    it("plans a connection again shortly when the provider's concurrency cap is full", async () => {
        const { scheduler, schedule, limiter, poller } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])
        limiter.enter.mockResolvedValue(undefined)

        const tallies = await scheduler.tick()

        expect(poller.fetch).not.toHaveBeenCalled()
        expect(schedule.defer).toHaveBeenCalledWith("c-1", new Date(NOW_MS + 5000))
        expect(tallies.get("sepay")?.deferred).toBe(1)
    })
})

describe("PollSchedulerService a poll that read", () => {
    it("plans the next poll from the adaptive interval, releases the slot and counts the items", async () => {
        const { scheduler, schedule, limiter } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])
        const release = jest.fn().mockResolvedValue(undefined)
        limiter.enter.mockResolvedValue({ release })

        await scheduler.tick()

        expect(limiter.enter).toHaveBeenCalledWith("sepay", "c-1", limits)
        expect(release).toHaveBeenCalledTimes(1)
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ nextPollAt: NOW_MS + 30 * MIN, failures: 0, succeeded: true }),
        )
    })

    it("takes a token of the connection's bucket before every call to the provider", async () => {
        const { scheduler, schedule, limiter } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])

        await scheduler.tick()

        expect(limiter.pass).toHaveBeenCalledWith("sepay", "c-1", limits)
    })

    it("does not count a connection the provider could not read as a read", async () => {
        const { scheduler, schedule, poller } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])
        poller.fetch.mockResolvedValue({ kind: "skipped", reason: "no_token" })

        const tallies = await scheduler.tick()

        expect(tallies.get("sepay")).toMatchObject({ found: 0, missedByWebhook: 0 })
        expect(schedule.settle).toHaveBeenCalledWith("c-1", expect.objectContaining({ succeeded: false }))
    })

    it("clears the degraded mark when the probe of an open breaker reads", async () => {
        const built = await build({ kind: "fatal" })
        built.schedule.claimDue.mockResolvedValue([dueOf({ breakerState: "open", failures: 5 })])
        built.poller.fetch.mockResolvedValue({ kind: "page", items: [], fetched: 0, oldestAt: undefined, newestAt: undefined })
        await built.scheduler.tick()

        expect(built.connections.markHealth).toHaveBeenCalledWith("c-1", expect.objectContaining({ state: "ok" }))
        expect(built.connections.markRecovered).not.toHaveBeenCalled()
    })

    it("lets an open breaker's due poll through as its probe and closes it on success", async () => {
        const { scheduler, schedule } = await build()
        schedule.claimDue.mockResolvedValue([
            dueOf({ breakerState: "open", failures: 5, breakerOpenedAt: new Date(NOW_MS - 20 * MIN) }),
        ])

        await scheduler.tick()

        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ breakerState: "closed", failures: 0 }),
        )
    })
})

/** Answers full pages, each older than the last, then an empty page: a provider with a long history. */
const olderPages = (poller: ReturnType<typeof mock<ConnectionPoller<unknown>>>, full = 100): void => {
    let served = 0
    poller.fetch.mockImplementation(() => {
        served += 1
        return Promise.resolve(
            served > full
                ? readPollPageOf(0, { items: [], oldestAt: undefined, newestAt: undefined })
                : readPollPageOf(200, { oldestAt: new Date(NOW_MS - served * 10 * MIN) }),
        )
    })
}

describe("PollSchedulerService backfill in chunks", () => {
    it("reads a first connect in a chunk of pages and carries where it stopped", async () => {
        const { scheduler, schedule, connections, poller } = await build()
        connections.find.mockResolvedValue(pollConnectionRecordOf({ meta: {} }))
        schedule.claimDue.mockResolvedValue([dueOf()])
        olderPages(poller)

        await scheduler.tick()

        expect(poller.fetch).toHaveBeenCalledTimes(DEFAULT_POLL_SCHEDULE.backfillChunkPages)
        expect(connections.patch).not.toHaveBeenCalled()
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({
                intervalMs: DEFAULT_POLL_SCHEDULE.hotIntervalMs,
                backfillTo: NOW_MS - 20 * MIN,
                backfillNewest: NOW_MS - MIN,
            }),
        )
    })

    it("resumes at the page end the last chunk stopped at", async () => {
        const { scheduler, schedule, connections, poller } = await build()
        connections.find.mockResolvedValue(pollConnectionRecordOf({ meta: {} }))
        schedule.claimDue.mockResolvedValue([
            dueOf({ backfillTo: new Date(NOW_MS - 30 * MIN), backfillNewest: new Date(NOW_MS - MIN) }),
        ])

        await scheduler.tick()

        expect(poller.fetch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ to: new Date(NOW_MS - 30 * MIN) }),
        )
        const [workspaceId, connectionId, patch] = connections.patch.mock.calls[0] ?? []
        expect([workspaceId, connectionId]).toEqual(["ws-1", "c-1"])
        expect(patch?.meta?.[POLL_CURSOR_KEY]).toBe(new Date(NOW_MS - MIN).toISOString())
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ backfillTo: null, backfillNewest: null }),
        )
    })

    it("resumes without a newest instant when the earlier chunks read none", async () => {
        const { scheduler, schedule, connections, poller } = await build()
        connections.find.mockResolvedValue(pollConnectionRecordOf({ meta: {} }))
        schedule.claimDue.mockResolvedValue([dueOf({ backfillTo: new Date(NOW_MS - 30 * MIN) })])
        poller.fetch.mockResolvedValue(readPollPageOf(0, { items: [], oldestAt: undefined, newestAt: undefined }))

        await scheduler.tick()

        expect(poller.fetch).toHaveBeenCalledTimes(1)
        expect(schedule.settle).toHaveBeenCalledWith("c-1", expect.objectContaining({ backfillTo: null }))
    })

    it("reads a connection that has a cursor without a page cap", async () => {
        const { scheduler, schedule, poller } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])
        olderPages(poller, 3)

        await scheduler.tick()

        expect(poller.fetch).toHaveBeenCalledTimes(4)
    })
})

describe("PollSchedulerService failures", () => {
    const failing = async (failure: PollFailure, row: Partial<PollScheduleRow> = {}) => {
        const built = await build(failure)
        built.schedule.claimDue.mockResolvedValue([dueOf(row)])
        built.poller.fetch.mockRejectedValue(new Error("provider failed"))
        const tallies = await built.scheduler.tick()
        return { ...built, tallies }
    }

    it("backs off a 429 for at least its Retry-After and counts it", async () => {
        const { schedule, tallies, notice } = await failing({ kind: "rate_limited", retryAfterSeconds: 600 })

        expect(tallies.get("sepay")?.rateLimited).toBe(1)
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ nextPollAt: NOW_MS + 10 * MIN, breakerState: "closed", failures: 1 }),
        )
        expect(notice.needsReauth).not.toHaveBeenCalled()
    })

    it("retries a transient failure with backoff and opens the breaker at the threshold", async () => {
        const { schedule, tallies, logger } = await failing({ kind: "transient" }, { failures: 4 })

        expect(tallies.get("sepay")?.transient).toBe(1)
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ breakerState: "open", failures: 5 }),
        )
        expect(logger.warn).toHaveBeenCalledWith(
            ConnectionPollLogEvent.BreakerOpened,
            expect.objectContaining({ connectionId: "c-1", kind: "transient" }),
        )
    })

    it("stops polling a refused credential, parks the connection and raises one owner work item", async () => {
        const { schedule, tallies, notice, logger } = await failing({ kind: "auth_failed" })

        expect(tallies.get("sepay")?.authFailed).toBe(1)
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ needsReauth: true, breakerState: "open" }),
        )
        expect(notice.needsReauth).toHaveBeenCalledTimes(1)
        expect(notice.needsReauth).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1" }), NOW_MS, undefined)
        expect(logger.warn).toHaveBeenCalledWith(
            ConnectionPollLogEvent.NeedsReauth,
            expect.objectContaining({ connectionId: "c-1" }),
        )
    })

    it("tells the owner when the credential lacks the permission the poll needs", async () => {
        const { notice } = await failing({ kind: "auth_failed", reason: "permission" })

        expect(notice.needsReauth).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1" }), NOW_MS, "permission")
    })

    it("raises no second owner work item for a connection that is already parked", async () => {
        const { notice } = await failing({ kind: "auth_failed" }, { needsReauth: true })

        expect(notice.needsReauth).not.toHaveBeenCalled()
    })
})

describe("PollSchedulerService failures of the provider's side", () => {
    const failing = async (failure: PollFailure, row: Partial<PollScheduleRow> = {}) => {
        const built = await build(failure)
        built.schedule.claimDue.mockResolvedValue([dueOf(row)])
        built.poller.fetch.mockRejectedValue(new Error("provider failed"))
        const tallies = await built.scheduler.tick()
        return { ...built, tallies }
    }

    it("is no failure when the provider's plan lacks the capability: the breaker stays closed and the owner is told once, in the provider's words", async () => {
        const { schedule, tallies, notice, logger } = await failing({
            kind: "unavailable",
            reason: "plan",
            notice: "upgrade the plan",
        })

        expect(tallies.get("sepay")?.unavailable).toBe(1)
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({
                breakerState: "closed",
                failures: 0,
                unavailableReason: "plan",
                nextPollAt: NOW_MS + DEFAULT_POLL_SCHEDULE.unavailableRecheckMs,
            }),
        )
        expect(notice.unavailable).toHaveBeenCalledTimes(1)
        expect(notice.unavailable).toHaveBeenCalledWith(
            expect.objectContaining({ id: "c-1" }),
            "upgrade the plan",
            NOW_MS,
        )
        expect(notice.needsReauth).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(
            ConnectionPollLogEvent.Unavailable,
            expect.objectContaining({ connectionId: "c-1", reason: "plan" }),
        )
        expect(logger.warn).not.toHaveBeenCalledWith(ConnectionPollLogEvent.BreakerOpened, expect.anything())
    })

    it("tells the owner nothing more while the capability stays unavailable", async () => {
        const { notice } = await failing(
            { kind: "unavailable", reason: "plan", notice: "upgrade the plan" },
            { unavailableReason: "plan" },
        )

        expect(notice.unavailable).not.toHaveBeenCalled()
    })

    it("marks a connection degraded when the breaker opens for a reason that is no refused credential, and never for a refused one", async () => {
        const fatal = await failing({ kind: "fatal" })
        expect(fatal.connections.markHealth).toHaveBeenCalledWith("c-1", expect.objectContaining({ state: "degraded" }))
        const refused = await failing({ kind: "auth_failed" })
        expect(refused.connections.markHealth).not.toHaveBeenCalled()
        const slow = await failing({ kind: "transient" }, { failures: 0 })
        expect(slow.connections.markHealth).not.toHaveBeenCalled()
    })

    it("opens the breaker for a fatal failure without the owner", async () => {
        const { schedule, tallies, notice } = await failing({ kind: "fatal" })

        expect(tallies.get("sepay")?.fatal).toBe(1)
        expect(schedule.settle).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ breakerState: "open", needsReauth: false }),
        )
        expect(notice.needsReauth).not.toHaveBeenCalled()
    })
})

describe("PollSchedulerService a poll that waited for the rate limit", () => {
    it("plans the connection again after the wait the limiter named, and is no failure", async () => {
        const { scheduler, schedule, limiter, source, logger } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])
        limiter.pass.mockRejectedValue(
            new ConnectionPollError({ code: ConnectionPollErrorCode.Deferred, params: { waitMs: 12_000 } }),
        )

        const tallies = await scheduler.tick()

        expect(tallies.get("sepay")?.deferred).toBe(1)
        expect(schedule.defer).toHaveBeenCalledWith("c-1", new Date(NOW_MS + 12_000))
        expect(schedule.settle).not.toHaveBeenCalled()
        expect(source.classify).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(
            ConnectionPollLogEvent.Deferred,
            expect.objectContaining({ connectionId: "c-1" }),
        )
    })

    it("falls back to a short wait when the error names none that can be read", async () => {
        const { scheduler, schedule, limiter } = await build()
        schedule.claimDue.mockResolvedValue([dueOf()])
        limiter.pass.mockRejectedValue(new ConnectionPollError({ code: ConnectionPollErrorCode.Deferred }))

        await scheduler.tick()

        expect(schedule.defer).toHaveBeenCalledWith("c-1", new Date(NOW_MS + 5000))
    })

    it("lets a call through when its provider has no source any more", async () => {
        const { scheduler, schedule, limiter } = await build({ kind: "fatal" }, (source) => ({
            providers: () => ["sepay"],
            sourceOf: jest.fn().mockReturnValueOnce(source).mockReturnValue(undefined),
        }))
        schedule.claimDue.mockResolvedValue([dueOf()])

        await scheduler.tick()

        expect(limiter.pass).not.toHaveBeenCalled()
    })
})
