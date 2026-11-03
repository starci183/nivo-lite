import { FakeClock, mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"
import { ConnectionPollRun, emptyPollSummary } from "./connection-poll-run.service"
import { ConnectionPollLogEvent } from "./connection-poll.log-events"
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
    const run = new ConnectionPollRun({ clock: new FakeClock(NOW.toISOString()), logger, timer, connections })
    return { run, logger, timer, connections, poller }
}

describe("ConnectionPollRun a connection that is read", () => {
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

describe("ConnectionPollRun a connection that is left out or fails", () => {
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

        await expect(run.poll(poller, recordOf(), summary)).resolves.toBeUndefined()

        expect(summary.failed).toBe(1)
        expect(logger.error).toHaveBeenCalledWith(ConnectionPollLogEvent.Failed, failure, {
            connectionId: "conn-1",
            provider: "sepay",
        })
    })
})
