import { FakeClock, mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"
import { ConnectionPollRunService, emptyPollSummary } from "./connection-poll-run.service"
import { ConnectionPollLogEvent } from "./connection-poll.log-events"
import { ConnectionPollError, ConnectionPollErrorCode } from "./errors/connection-poll.error"
import type { ConnectionPoller, PollPage } from "./connection-poll.contracts"
import { POLL_CURSOR_KEY, POLL_MAX_PAGES, POLL_PAGE_SIZE, POLL_PAUSE_MS } from "./connection-poll.policy"

const NOW = new Date("2026-11-04T10:00:00.000Z")
const T1 = new Date("2026-11-04T01:06:00.000Z")
const T2 = new Date("2026-11-04T00:50:00.000Z")

const recordOf = (extra: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "conn-1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "SePay",
    meta: { bank_code: "VCB" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-03T00:00:00.000Z",
    ...extra,
})

const pageOf = (items: ReadonlyArray<string>, fetched: number, newestAt: Date, oldestAt: Date): PollPage<string> => ({
    kind: "page",
    items,
    fetched,
    oldestAt,
    newestAt,
})

const build = () => {
    const logger = mock<Logger>()
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback) => {
        callback()
        return () => undefined
    })
    const connections = mock<ConnectionsService>()
    connections.get.mockResolvedValue(recordOf())
    connections.patch.mockResolvedValue(undefined)
    const poller = mock<ConnectionPoller<string>>()
    const run = new ConnectionPollRunService({ clock: new FakeClock(NOW.toISOString()), logger, timer, connections })
    return { run, logger, timer, connections, poller }
}

describe("ConnectionPollRunService a connection that is read", () => {
    it("stores each item, warns for the ones the webhook missed and moves the cursor to the newest instant", async () => {
        const { run, logger, connections, poller } = build()
        poller.fetch.mockResolvedValue(pageOf(["a", "b"], 2, T1, T2))
        poller.store.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        const summary = emptyPollSummary()

        await run.poll(poller, recordOf(), summary)

        expect(summary).toEqual({ connections: 1, fetched: 2, recorded: 1, skipped: 0, failed: 0 })
        expect(logger.warn).toHaveBeenCalledWith(ConnectionPollLogEvent.MissedByWebhook, {
            connectionId: "conn-1",
            provider: "sepay",
            missed: 1,
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "conn-1", {
            meta: { bank_code: "VCB", [POLL_CURSOR_KEY]: T1.toISOString() },
        })
        expect(poller.fetch).toHaveBeenCalledWith(recordOf(), {
            from: new Date(NOW.getTime() - 7 * 86_400_000),
            to: undefined,
            limit: POLL_PAGE_SIZE,
        })
    })

    it("neither warns nor moves the cursor when the webhook delivered everything and nothing is newer", async () => {
        const { run, logger, connections, poller } = build()
        poller.fetch.mockResolvedValue(pageOf(["a"], 1, T1, T1))
        poller.store.mockResolvedValue(false)
        const record = recordOf({ meta: { [POLL_CURSOR_KEY]: T1.toISOString() } })

        await run.poll(poller, record, emptyPollSummary())

        expect(logger.warn).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("does not move the cursor on an empty first read", async () => {
        const { run, connections, poller } = build()
        poller.fetch.mockResolvedValue({
            kind: "page",
            items: [],
            fetched: 0,
            oldestAt: undefined,
            newestAt: undefined,
        })

        await run.poll(poller, recordOf(), emptyPollSummary())

        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("walks older pages while the page is full, with a pause between calls", async () => {
        const { run, timer, poller } = build()
        poller.fetch
            .mockResolvedValueOnce(pageOf(["a"], POLL_PAGE_SIZE, T1, T2))
            .mockResolvedValueOnce(pageOf(["b"], 1, T2, T2))
        poller.store.mockResolvedValue(true)
        const summary = emptyPollSummary()

        await run.poll(poller, recordOf(), summary)

        expect(summary).toMatchObject({ fetched: POLL_PAGE_SIZE + 1, recorded: 2 })
        expect(poller.fetch).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ to: T2 }))
        expect(timer.schedule).toHaveBeenCalledTimes(1)
        expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), POLL_PAUSE_MS)
    })
})

describe("ConnectionPollRunService the page budget", () => {
    it("reads no more than the page budget", async () => {
        const { run, poller } = build()
        let oldest = T1.getTime()
        poller.fetch.mockImplementation(() => {
            oldest -= 1000
            return Promise.resolve(pageOf([], POLL_PAGE_SIZE, T1, new Date(oldest)))
        })

        await run.poll(poller, recordOf(), emptyPollSummary())

        expect(poller.fetch).toHaveBeenCalledTimes(POLL_MAX_PAGES)
    })
})

describe("ConnectionPollRunService a connection that is left out or fails", () => {
    it("leaves a test-environment connection out without calling the provider", async () => {
        const { run, logger, poller } = build()
        const summary = emptyPollSummary()

        await run.poll(poller, recordOf({ environment: "test" }), summary)

        expect(poller.fetch).not.toHaveBeenCalled()
        expect(summary).toMatchObject({ connections: 1, skipped: 1 })
        expect(logger.info).toHaveBeenCalledWith(ConnectionPollLogEvent.Skipped, {
            connectionId: "conn-1",
            provider: "sepay",
            reason: "test_environment",
        })
    })

    it("counts a connection the poller skips and stores nothing", async () => {
        const { run, poller, connections } = build()
        poller.fetch.mockResolvedValue({ kind: "skipped", reason: "no_token" })
        const summary = emptyPollSummary()

        await run.poll(poller, recordOf(), summary)

        expect(summary).toMatchObject({ skipped: 1, recorded: 0 })
        expect(poller.store).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("logs and counts a failed read instead of throwing", async () => {
        const { run, logger, poller } = build()
        const failure = new Error("down")
        poller.fetch.mockRejectedValue(failure)
        const summary = emptyPollSummary()

        await expect(run.poll(poller, recordOf(), summary)).resolves.toEqual({ kind: "failed", cause: failure })

        expect(summary.failed).toBe(1)
        expect(logger.error).toHaveBeenCalledWith(ConnectionPollLogEvent.Failed, failure, {
            connectionId: "conn-1",
            provider: "sepay",
        })
    })
})

describe("ConnectionPollRunService the outcome a scheduler plans with", () => {
    it("answers done with what it read and stored", async () => {
        const { run, poller } = build()
        poller.fetch.mockResolvedValue(pageOf(["a", "b"], 2, T1, T2))
        poller.store.mockResolvedValue(true)

        await expect(run.poll(poller, recordOf(), emptyPollSummary())).resolves.toEqual({
            kind: "done",
            fetched: 2,
            recorded: 2,
        })
    })

    it("answers skipped with the reason", async () => {
        const { run, poller } = build()
        poller.fetch.mockResolvedValue({ kind: "skipped", reason: "no_token" })

        await expect(run.poll(poller, recordOf(), emptyPollSummary())).resolves.toEqual({
            kind: "skipped",
            reason: "no_token",
        })
    })
})

describe("ConnectionPollRunService the gate and the chunks of a backfill", () => {
    it("takes the gate before every call to the provider and ends the poll when the gate refuses", async () => {
        const logger = mock<Logger>()
        const timer = mock<Timer>()
        timer.schedule.mockImplementation((callback) => {
            callback()
            return () => undefined
        })
        const connections = mock<ConnectionsService>()
        const gate = jest.fn<Promise<void>, [ConnectionRecord]>()
        gate.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("deferred"))
        const run = new ConnectionPollRunService({
            clock: new FakeClock(NOW.toISOString()),
            logger,
            timer,
            connections,
            beforeFetch: gate,
        })
        const poller = mock<ConnectionPoller<string>>()
        poller.fetch.mockResolvedValue(pageOf(["a"], POLL_PAGE_SIZE, T1, T2))
        poller.store.mockResolvedValue(true)

        const outcome = await run.poll(poller, recordOf(), emptyPollSummary())

        expect(gate).toHaveBeenCalledTimes(2)
        expect(gate).toHaveBeenCalledWith(expect.objectContaining({ id: "conn-1" }))
        expect(poller.fetch).toHaveBeenCalledTimes(1)
        expect(outcome.kind).toBe("failed")
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("stops a chunk at its page cap, keeps the cursor and says where the next chunk resumes", async () => {
        const { run, poller, connections } = build()
        let oldest = T1.getTime()
        poller.fetch.mockImplementation(() => {
            oldest -= 1000
            return Promise.resolve(pageOf(["a"], POLL_PAGE_SIZE, T1, new Date(oldest)))
        })
        poller.store.mockResolvedValue(true)

        const outcome = await run.poll(poller, recordOf(), emptyPollSummary(), { maxPages: 2 })

        expect(poller.fetch).toHaveBeenCalledTimes(2)
        expect(outcome).toEqual({
            kind: "partial",
            fetched: 2 * POLL_PAGE_SIZE,
            recorded: 2,
            resumeTo: new Date(T1.getTime() - 2000),
            newest: T1,
        })
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("resumes a chunk from the page end and the newest instant the last chunk carried, and then saves the cursor", async () => {
        const { run, poller, connections } = build()
        const carried = new Date("2026-11-04T09:00:00.000Z")
        poller.fetch.mockResolvedValue(pageOf(["a"], 1, T2, T2))
        poller.store.mockResolvedValue(true)

        const outcome = await run.poll(poller, recordOf(), emptyPollSummary(), { to: T2, newest: carried, maxPages: 2 })

        expect(poller.fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ to: T2 }))
        expect(outcome.kind).toBe("done")
        const [workspaceId, connectionId, patch] = connections.patch.mock.calls[0] ?? []
        expect([workspaceId, connectionId]).toEqual(["ws-1", "conn-1"])
        expect(patch?.meta?.[POLL_CURSOR_KEY]).toBe(carried.toISOString())
    })
})

describe("ConnectionPollRunService why a provider refused", () => {
    it("logs the code and the params of a domain error next to the connection, so the refusal can be read", async () => {
        const { run, logger, poller } = build()
        const failure = new ConnectionPollError({ code: ConnectionPollErrorCode.Deferred, params: { waitMs: 7000 } })
        poller.fetch.mockRejectedValue(failure)

        await run.poll(poller, recordOf(), emptyPollSummary())

        expect(logger.error).toHaveBeenCalledWith(ConnectionPollLogEvent.Failed, failure, {
            connectionId: "conn-1",
            provider: "sepay",
            errorCode: "CONNECTION_POLL_DEFERRED",
            waitMs: 7000,
        })
    })
})
