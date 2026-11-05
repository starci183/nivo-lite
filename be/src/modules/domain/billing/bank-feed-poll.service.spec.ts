import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionPollLogEvent, emptyPollSummary } from "@modules/domain/connection-poll"
import { BankFeedPollerRegistryService } from "@modules/domain/provider-registry"
import type { BankFeedPoller } from "@modules/domain/provider-registry"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord, HealthCandidate } from "@modules/domain/connections"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { BankFeedPollService } from "./bank-feed-poll.service"
import { BankFeedReceiptsService } from "./bank-feed-receipts.service"

const recordOf = (
    id: string,
    provider: ConnectionRecord["provider"],
    status: ConnectionRecord["status"] = "connected",
): ConnectionRecord => ({
    id,
    workspaceId: "ws-1",
    provider,
    name: provider,
    meta: {},
    status,
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-03T00:00:00.000Z",
})

const candidate = (id: string, provider: string): HealthCandidate => ({
    id,
    workspaceId: "ws-1",
    provider,
    name: provider,
    status: "connected",
    lastError: "",
    lastEventAt: "",
    createdAt: "",
    health: "",
})

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.get.mockResolvedValue(recordOf("sepay-1", "sepay"))
    connections.patch.mockResolvedValue(undefined)
    const sepay = Object.assign(mock<BankFeedPoller>(), { provider: "sepay", inboxProvider: "sepay-feed" as const })
    sepay.fetch.mockResolvedValue({ kind: "skipped", reason: "no_token" })
    const feed = mock<BankFeedReceiptsService>()
    const logger = mock<Logger>()
    const timer = mock<Timer>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedPollService,
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: TIMER, useValue: timer },
            { provide: ConnectionsService, useValue: connections },
            BankFeedPollerRegistryService,
            { provide: BankFeedReceiptsService, useValue: feed },
        ],
    }).compile()
    moduleRef.get(BankFeedPollerRegistryService).register(sepay)
    return { service: moduleRef.get(BankFeedPollService), connections, sepay, logger, feed }
}

describe("BankFeedPollService reconcileAll", () => {
    it("polls the connections of a polled provider only", async () => {
        const { service, connections, sepay, logger } = await build()
        connections.healthBatch.mockResolvedValue([candidate("sepay-1", "sepay"), candidate("tg-1", "telegram")])
        connections.find.mockResolvedValue(recordOf("sepay-1", "sepay"))

        await expect(service.reconcileAll()).resolves.toEqual({
            connections: 1,
            fetched: 0,
            recorded: 0,
            skipped: 1,
            failed: 0,
        })

        expect(sepay.fetch).toHaveBeenCalledTimes(1)
        expect(connections.find).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith(ConnectionPollLogEvent.Done, expect.objectContaining({ skipped: 1 }))
    })

    it("scans the next page of connections after a full one and ignores a connection that vanished", async () => {
        const { service, connections } = await build()
        const full = Array.from({ length: 200 }, (_value, index) => candidate(`tg-${index}`, "telegram"))
        connections.healthBatch
            .mockResolvedValueOnce(full)
            .mockResolvedValueOnce([candidate("sepay-1", "sepay")])
            .mockResolvedValue([])
        connections.find.mockResolvedValue(null)

        await expect(service.reconcileAll()).resolves.toMatchObject({ connections: 0 })

        expect(connections.healthBatch).toHaveBeenNthCalledWith(2, "tg-199", 200)
    })
})

describe("BankFeedPollService polls", () => {
    it("knows which providers it can read back", async () => {
        const { service } = await build()

        expect(service.polls("sepay")).toBe(true)
        expect(service.polls("telegram")).toBe(false)
    })
})

describe("BankFeedPollService reconcileFromJob", () => {
    it("polls everything when the payload names no connection", async () => {
        const { service, connections } = await build()
        connections.healthBatch.mockResolvedValue([])

        await service.reconcileFromJob({})

        expect(connections.healthBatch).toHaveBeenCalledWith("", 200)
        expect(connections.find).not.toHaveBeenCalled()
    })

    it("polls the one connection the payload names", async () => {
        const { service, connections, sepay } = await build()
        connections.find.mockResolvedValue(recordOf("sepay-1", "sepay"))

        await service.reconcileFromJob({ connectionId: "sepay-1", workspaceId: "ws-1" })

        expect(connections.find).toHaveBeenCalledWith("ws-1", "sepay-1")
        expect(sepay.fetch).toHaveBeenCalledTimes(1)
    })

    it("polls nothing for a payload that is not a poll payload", async () => {
        const { service, connections } = await build()

        await expect(service.reconcileFromJob("not a payload")).resolves.toEqual(emptyPollSummary())

        expect(connections.healthBatch).not.toHaveBeenCalled()
        expect(connections.find).not.toHaveBeenCalled()
    })

    it.each([
        ["a connection that is gone", null],
        ["a disconnected connection", recordOf("sepay-1", "sepay", "disconnected")],
        ["a connection of a provider with no poller", recordOf("tg-1", "telegram")],
    ])("polls nothing for %s", async (_name, found) => {
        const { service, connections, sepay } = await build()
        connections.find.mockResolvedValue(found)

        await expect(service.reconcileOne("ws-1", "x")).resolves.toMatchObject({ connections: 0 })
        expect(sepay.fetch).not.toHaveBeenCalled()
    })
})

describe("BankFeedPollService storing", () => {
    it("stores a polled credit through the feed receipt under the webhook key of the provider inbox identity", async () => {
        const { service, connections, sepay, feed } = await build()
        const credit = { amount: 5000, content: "x", eventId: "sepay:1", fallbackBankName: "MBBank" }
        connections.find.mockResolvedValue(recordOf("sepay-1", "sepay"))
        sepay.fetch.mockResolvedValue({
            kind: "page",
            items: [{ deliveryId: "sepay-1:sepay:1", credit }],
            fetched: 1,
            oldestAt: new Date("2026-11-04T01:06:00.000Z"),
            newestAt: new Date("2026-11-04T01:06:00.000Z"),
        })
        feed.acceptPolledCredit.mockResolvedValue(true)

        await expect(service.reconcileOne("ws-1", "sepay-1")).resolves.toMatchObject({ fetched: 1, recorded: 1 })

        expect(feed.acceptPolledCredit).toHaveBeenCalledWith("sepay-1", "sepay-feed", "sepay-1:sepay:1", credit)
    })
})
