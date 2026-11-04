import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionPollLogEvent } from "@modules/domain/connection-poll"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord, HealthCandidate } from "@modules/domain/connections"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"
import { ZaloInboxPollService } from "./zalo-poll.service"

const NOW = "2026-11-04T10:00:00.000Z"

const recordOf = (id: string, status: ConnectionRecord["status"] = "connected"): ConnectionRecord =>
    mock<ConnectionRecord>({ id, workspaceId: "ws-1", provider: "zalo_oa", meta: {}, status, environment: "live" })

const candidate = (id: string, provider: string): HealthCandidate =>
    mock<HealthCandidate>({ id, workspaceId: "ws-1", provider })

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.get.mockResolvedValue(recordOf("zalo-1"))
    connections.patch.mockResolvedValue(undefined)
    const poller = mock<ZaloInboxPollerService>({ provider: "zalo_oa" })
    poller.fetch.mockResolvedValue({ kind: "skipped", reason: "no_token" })
    const logger = mock<Logger>()
    const timer = mock<Timer>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxPollService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: TIMER, useValue: timer },
            { provide: ConnectionsService, useValue: connections },
            { provide: ZaloInboxPollerService, useValue: poller },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloInboxPollService), connections, poller, logger }
}

describe("ZaloInboxPollService reconcileAll", () => {
    it("polls the Zalo connections only and logs the run", async () => {
        const { service, connections, poller, logger } = await build()
        connections.healthBatch.mockResolvedValue([candidate("zalo-1", "zalo_oa"), candidate("tg-1", "telegram")])
        connections.find.mockResolvedValue(recordOf("zalo-1"))

        await expect(service.reconcileAll()).resolves.toEqual({
            connections: 1,
            fetched: 0,
            recorded: 0,
            skipped: 1,
            failed: 0,
        })

        expect(poller.fetch).toHaveBeenCalledTimes(1)
        expect(connections.find).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith(ConnectionPollLogEvent.Done, expect.objectContaining({ skipped: 1 }))
    })

    it("scans the next page of connections after a full one and ignores a connection that vanished", async () => {
        const { service, connections } = await build()
        const full = Array.from({ length: 200 }, (_value, index) => candidate(`tg-${index}`, "telegram"))
        connections.healthBatch
            .mockResolvedValueOnce(full)
            .mockResolvedValueOnce([candidate("zalo-1", "zalo_oa")])
            .mockResolvedValue([])
        connections.find.mockResolvedValue(null)

        await expect(service.reconcileAll()).resolves.toMatchObject({ connections: 0 })

        expect(connections.healthBatch).toHaveBeenNthCalledWith(2, "tg-199", 200)
    })

    it("counts a connection whose read fails and goes on with the next one", async () => {
        const { service, connections, poller } = await build()
        connections.healthBatch.mockResolvedValueOnce([candidate("zalo-1", "zalo_oa"), candidate("zalo-2", "zalo_oa")])
        connections.healthBatch.mockResolvedValue([])
        connections.find.mockImplementation((_workspaceId, id) => Promise.resolve(recordOf(id)))
        poller.fetch.mockRejectedValueOnce(new Error("zalo down"))

        await expect(service.reconcileAll()).resolves.toMatchObject({ connections: 2, failed: 1, skipped: 1 })
    })
})

describe("ZaloInboxPollService reconcileFromJob", () => {
    it("polls everything when the payload names no connection", async () => {
        const { service, connections } = await build()
        connections.healthBatch.mockResolvedValue([])

        await service.reconcileFromJob({})

        expect(connections.healthBatch).toHaveBeenCalledWith("", 200)
        expect(connections.find).not.toHaveBeenCalled()
    })

    it("polls the one connection the payload names", async () => {
        const { service, connections, poller } = await build()
        connections.find.mockResolvedValue(recordOf("zalo-1"))

        await service.reconcileFromJob({ connectionId: "zalo-1", workspaceId: "ws-1" })

        expect(connections.find).toHaveBeenCalledWith("ws-1", "zalo-1")
        expect(poller.fetch).toHaveBeenCalledTimes(1)
    })

    it.each([
        ["a connection that is gone", null],
        ["a disconnected connection", recordOf("zalo-1", "disconnected")],
    ])("polls nothing for %s", async (_name, found) => {
        const { service, connections, poller } = await build()
        connections.find.mockResolvedValue(found)

        await expect(service.reconcileOne("ws-1", "x")).resolves.toMatchObject({ connections: 0 })
        expect(poller.fetch).not.toHaveBeenCalled()
    })
})

describe("ZaloInboxPollService polls", () => {
    it("reads back the connections of Zalo and no other provider", async () => {
        const { service } = await build()

        expect(service.polls("zalo_oa")).toBe(true)
        expect(service.polls("sepay")).toBe(false)
    })
})
