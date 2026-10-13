import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord, ConnectionStatus } from "@modules/domain/connections"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ConnectionLifecycleService } from "./connection-lifecycle.service"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }

const record = (status: ConnectionStatus = "connected"): ConnectionRecord => ({
    id: "connection-1",
    workspaceId: "ws-1",
    provider: "meta",
    name: "Shop Page",
    meta: { page_id: "PAGE-1" },
    status,
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-12T00:00:00.000Z",
})

const build = async (status: ConnectionStatus = "connected") => {
    const connections = mock<ConnectionsService>()
    const channels = mock<ChannelConnectionsService>()
    const meta = mock<MetaConnectionsService>()
    const connection = record(status)
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.get.mockResolvedValue(connection)
    connections.wipeSecret.mockResolvedValue(undefined)
    connections.patch.mockResolvedValue(undefined)
    connections.remove.mockResolvedValue(undefined)
    channels.release.mockResolvedValue(undefined)
    meta.release.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionLifecycleService,
            { provide: ConnectionsService, useValue: connections },
            { provide: ChannelConnectionsService, useValue: channels },
            { provide: MetaConnectionsService, useValue: meta },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionLifecycleService), connections, channels, meta, connection }
}

describe("ConnectionLifecycleService", () => {
    describe("disconnect", () => {
        it("authorizes the owner, releases both providers, wipes the credential and marks the row disconnected", async () => {
            const { service, connections, channels, meta, connection } = await build()

            await expect(service.disconnect(actor, "requested-1")).resolves.toBeUndefined()

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
            expect(connections.get).toHaveBeenCalledWith("ws-1", "requested-1")
            expect(channels.release).toHaveBeenCalledWith(connection)
            expect(meta.release).toHaveBeenCalledWith(connection)
            expect(connections.wipeSecret).toHaveBeenCalledWith("connection-1")
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "connection-1", {
                status: "disconnected",
                lastError: null,
            })
            const order = [
                connections.authorize.mock.invocationCallOrder[0],
                connections.get.mock.invocationCallOrder[0],
                channels.release.mock.invocationCallOrder[0],
                meta.release.mock.invocationCallOrder[0],
                connections.wipeSecret.mock.invocationCallOrder[0],
                connections.patch.mock.invocationCallOrder[0],
            ]
            expect(order).toEqual([...order].sort((left = 0, right = 0) => left - right))
            expect(connections.remove).not.toHaveBeenCalled()
        })

        it("propagates an authorization refusal before reading or releasing a connection", async () => {
            const { service, connections, channels, meta } = await build()
            const error = new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
            connections.authorize.mockRejectedValue(error)

            await expect(service.disconnect(actor, "connection-1")).rejects.toBe(error)

            expect(connections.get).not.toHaveBeenCalled()
            expect(channels.release).not.toHaveBeenCalled()
            expect(meta.release).not.toHaveBeenCalled()
            expect(connections.wipeSecret).not.toHaveBeenCalled()
            expect(connections.patch).not.toHaveBeenCalled()
        })

        it("keeps the credential when a provider cannot release the connection", async () => {
            const { service, connections, channels, meta } = await build()
            const error = new Error("provider unavailable")
            meta.release.mockRejectedValue(error)

            await expect(service.disconnect(actor, "connection-1")).rejects.toBe(error)

            expect(channels.release).toHaveBeenCalledWith(record())
            expect(meta.release).toHaveBeenCalledWith(record())
            expect(connections.wipeSecret).not.toHaveBeenCalled()
            expect(connections.patch).not.toHaveBeenCalled()
        })
    })

    describe("remove", () => {
        it("authorizes the owner and removes the disconnected row by its stored id", async () => {
            const { service, connections, channels, meta } = await build("disconnected")

            await expect(service.remove(actor, "requested-1")).resolves.toBeUndefined()

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
            expect(connections.get).toHaveBeenCalledWith("ws-1", "requested-1")
            expect(connections.remove).toHaveBeenCalledWith("ws-1", "connection-1")
            expect(channels.release).not.toHaveBeenCalled()
            expect(meta.release).not.toHaveBeenCalled()
            expect(connections.wipeSecret).not.toHaveBeenCalled()
            expect(connections.patch).not.toHaveBeenCalled()
        })

        it.each<ConnectionStatus>(["pending", "connected", "error"])(
            "refuses to remove a %s connection",
            async (status) => {
                const { service, connections } = await build(status)

                await expect(service.remove(actor, "connection-1")).rejects.toEqual(
                    new ConnectionsError({ code: ConnectionsErrorCode.StillConnected }),
                )

                expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
                expect(connections.get).toHaveBeenCalledWith("ws-1", "connection-1")
                expect(connections.remove).not.toHaveBeenCalled()
            },
        )

        it("propagates an authorization refusal before reading or removing a connection", async () => {
            const { service, connections } = await build("disconnected")
            const error = new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
            connections.authorize.mockRejectedValue(error)

            await expect(service.remove(actor, "connection-1")).rejects.toBe(error)

            expect(connections.get).not.toHaveBeenCalled()
            expect(connections.remove).not.toHaveBeenCalled()
        })
    })
})
