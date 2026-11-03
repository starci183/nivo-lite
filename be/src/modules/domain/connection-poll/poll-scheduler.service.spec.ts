import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { CONNECTION_POLL_OPTIONS, POLL_RANDOM } from "./connection-poll.decorators"
import type { ConnectionPoller, PollFailure, PollPage } from "./connection-poll.contracts"
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
import { PollSourceRegistry } from "./poll-source-registry.service"

const NOW = "2026-11-04T10:00:00.000Z"
const NOW_MS = Date.parse(NOW)
const MIN = 60_000
const limits = { ratePerSecond: 2, burst: 2, concurrency: 1 }

const rowOf = (over: Partial<PollScheduleRow> = {}): PollScheduleRow => ({
    connectionId: "c-1",
    workspaceId: "ws-1",
    provider: "sepay",
    intervalMs: 30 * MIN,
    failures: 0,
    breakerState: "closed",
    breakerOpenedAt: null,
    needsReauth: false,
    hotUntil: null,
    lastSuccessAt: null,
    lastWebhookAt: new Date(NOW_MS - MIN),
    backfillTo: null,
    backfillNewest: null,
    ...over,
})

const dueOf = (over: Partial<PollScheduleRow> = {}, lagMs = 2000): DueConnection => ({
    row: rowOf(over),
    dueAt: new Date(NOW_MS - lagMs),
})

const recordOf = (over: Partial<ConnectionRecord> = {}): ConnectionRecord =>
    ({
        id: "c-1",
        workspaceId: "ws-1",
        provider: "sepay",
        name: "SePay",
        meta: { [POLL_CURSOR_KEY]: "2026-11-04T09:00:00.000Z" },
        status: "connected",
        environment: "live",
        ...over,
    }) as ConnectionRecord

const page = (fetched: number, over: Partial<Extract<PollPage<string>, { kind: "page" }>> = {}): PollPage<string> => ({
    kind: "page",
    items: ["a", "b"],
    fetched,
    oldestAt: new Date(NOW_MS - 10 * MIN),
    newestAt: new Date(NOW_MS - MIN),
    ...over,
})

const build = async (
    classified: PollFailure = { kind: "transient" },
    directoryOf: (source: ScheduledPollSource) => PollSourceDirectory = (source) => ({
        providers: () => ["sepay"],
        sourceOf: (provider) => (provider === "sepay" ? source : undefined),
    }),
) => {
    const poller = mock<ConnectionPoller<unknown>>()
    poller.fetch.mockResolvedValue(page(2))
    poller.store.mockResolvedValue(true)
    const source: ScheduledPollSource = {
        provider: "sepay",
        limits,
        poller,
        classify: jest.fn().mockReturnValue(classified),
    }
    const sources = new PollSourceRegistry()
    sources.add(directoryOf(source))
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(recordOf())
    connections.get.mockResolvedValue(recordOf())
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
            { provide: POLL_RANDOM, useValue: () => 0.5 },
            { provide: CONNECTION_POLL_OPTIONS, useValue: { schedule: DEFAULT_POLL_SCHEDULE, redis: undefined } },
            { provide: ConnectionsService, useValue: connections },
            { provide: PollScheduleService, useValue: schedule },
            { provide: PollSourceRegistry, useValue: sources },
            { provide: PollLimiterService, useValue: limiter },
            { provide: PollOwnerNoticeService, useValue: notice },
        ],
    }).compile()
    return { scheduler: moduleRef.get(PollSchedulerService), poller, source, connections, schedule, limiter, notice, logger }
}

describe("PollSchedulerService tick picking", () => {
    it("does nothing when no provider can be polled", async () => {
        const { scheduler, schedule } = await build({ kind: "fatal" }, () => ({ providers: () => [], sourceOf: () => undefined }))

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
        expect(logger.info).toHaveBeenCalledWith(ConnectionPollLogEvent.Metrics, expect.objectContaining({ provider: "sepay", polled: 2, maxLagMs: 9000 }))
    })
})

describe("PollSchedulerService connections that cannot be polled", () => {
    it.each([
        ["a connection that is gone", null],
        ["a disconnected connection", recordOf({ status: "disconnected" })],
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

    it("lets an open breaker's due poll through as its probe and closes it on success", async () => {
        const { scheduler, schedule } = await build()
        schedule.claimDue.mockResolvedValue([dueOf({ breakerState: "open", failures: 5, breakerOpenedAt: new Date(NOW_MS - 20 * MIN) })])

        await scheduler.tick()

        expect(schedule.settle).toHaveBeenCalledWith("c-1", expect.objectContaining({ breakerState: "closed", failures: 0 }))
    })
})

/** Answers full pages, each older than the last, then an empty page: a provider with a long history. */
const olderPages = (poller: ReturnType<typeof mock<ConnectionPoller<unknown>>>, full = 100): void => {
    let served = 0
    poller.fetch.mockImplementation(() => {
        served += 1
        return Promise.resolve(
            served > full
                ? page(0, { items: [], oldestAt: undefined, newestAt: undefined })
                : page(200, { oldestAt: new Date(NOW_MS - served * 10 * MIN) }),
        )
    })
}

describe("PollSchedulerService backfill in chunks", () => {
    it("reads a first connect in a chunk of pages and carries where it stopped", async () => {
        const { scheduler, schedule, connections, poller } = await build()
        connections.find.mockResolvedValue(recordOf({ meta: {} }))
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
        connections.find.mockResolvedValue(recordOf({ meta: {} }))
        schedule.claimDue.mockResolvedValue([
            dueOf({ backfillTo: new Date(NOW_MS - 30 * MIN), backfillNewest: new Date(NOW_MS - MIN) }),
        ])

        await scheduler.tick()

        expect(poller.fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ to: new Date(NOW_MS - 30 * MIN) }))
        expect(connections.patch).toHaveBeenCalledWith(
            "ws-1",
            "c-1",
            { meta: expect.objectContaining({ [POLL_CURSOR_KEY]: new Date(NOW_MS - MIN).toISOString() }) },
        )
        expect(schedule.settle).toHaveBeenCalledWith("c-1", expect.objectContaining({ backfillTo: null, backfillNewest: null }))
    })

    it("resumes without a newest instant when the earlier chunks read none", async () => {
        const { scheduler, schedule, connections, poller } = await build()
        connections.find.mockResolvedValue(recordOf({ meta: {} }))
        schedule.claimDue.mockResolvedValue([dueOf({ backfillTo: new Date(NOW_MS - 30 * MIN) })])
        poller.fetch.mockResolvedValue(page(0, { items: [], oldestAt: undefined, newestAt: undefined }))

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
        expect(schedule.settle).toHaveBeenCalledWith("c-1", expect.objectContaining({ breakerState: "open", failures: 5 }))
        expect(logger.warn).toHaveBeenCalledWith(
            ConnectionPollLogEvent.BreakerOpened,
            expect.objectContaining({ connectionId: "c-1", kind: "transient" }),
        )
    })

    it("stops polling a refused credential, parks the connection and raises one owner work item", async () => {
        const { schedule, tallies, notice, logger } = await failing({ kind: "auth_failed" })

        expect(tallies.get("sepay")?.authFailed).toBe(1)
        expect(schedule.settle).toHaveBeenCalledWith("c-1", expect.objectContaining({ needsReauth: true, breakerState: "open" }))
        expect(notice.needsReauth).toHaveBeenCalledTimes(1)
        expect(notice.needsReauth).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1" }), NOW_MS)
        expect(logger.warn).toHaveBeenCalledWith(ConnectionPollLogEvent.NeedsReauth, expect.objectContaining({ connectionId: "c-1" }))
    })

    it("raises no second owner work item for a connection that is already parked", async () => {
        const { notice } = await failing({ kind: "auth_failed" }, { needsReauth: true })

        expect(notice.needsReauth).not.toHaveBeenCalled()
    })

    it("opens the breaker for a fatal failure without the owner", async () => {
        const { schedule, tallies, notice } = await failing({ kind: "fatal" })

        expect(tallies.get("sepay")?.fatal).toBe(1)
        expect(schedule.settle).toHaveBeenCalledWith("c-1", expect.objectContaining({ breakerState: "open", needsReauth: false }))
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
        expect(logger.info).toHaveBeenCalledWith(ConnectionPollLogEvent.Deferred, expect.objectContaining({ connectionId: "c-1" }))
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
