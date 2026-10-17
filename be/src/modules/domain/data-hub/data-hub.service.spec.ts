import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { DataConnectionDraft } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubErrorCode } from "./errors/data-hub.error"

const actor = { workspaceId: "w-1", principalId: "p-1" }
const record: ConnectionRecord = {
    id: "c-1",
    workspaceId: "w-1",
    provider: "database",
    name: "Orders",
    status: "connected",
    meta: { host: "db" },
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "p-1",
    createdAt: "2026-10-12T10:00:00.000Z",
}
const draft: DataConnectionDraft = {
    provider: "database",
    name: "Orders",
    credential: "secret",
    meta: { host: "db" },
    everyMinutes: null,
}

const build = async () => {
    const connections = mock<ConnectionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [DataHubService, { provide: ConnectionsService, useValue: connections }],
    }).compile()
    return { service: moduleRef.get(DataHubService), connections }
}

describe("DataHubService", () => {
    it("answers null when the connection has no stored credential", async () => {
        const { service, connections } = await build()
        connections.readSecret.mockResolvedValue(null)

        await expect(service.credentialOf("c-1")).resolves.toBeNull()
    })

    it("answers the opened credential text", async () => {
        const { service, connections } = await build()
        connections.readSecret.mockResolvedValue({ plain: '{"host":"db"}', webhookSecret: "" })

        await expect(service.credentialOf("c-1")).resolves.toBe('{"host":"db"}')
    })

    it("authorizes the owner and forwards credential, grant and deletion operations", async () => {
        const { service, connections } = await build()
        const member = { role: "owner", displayName: "Owner" }
        connections.authorize.mockResolvedValue(member)
        connections.writeSecret.mockResolvedValue(undefined)
        connections.agentIds.mockResolvedValue(["agent-1"])
        connections.remove.mockResolvedValue(undefined)
        await expect(service.owner(actor)).resolves.toBe(member)
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        await expect(service.saveCredential("c-1", "sealed text")).resolves.toBeUndefined()
        expect(connections.writeSecret).toHaveBeenCalledWith("c-1", "sealed text")
        await expect(service.agentIds("w-1", "c-1")).resolves.toEqual(["agent-1"])
        expect(connections.agentIds).toHaveBeenCalledWith("w-1", "c-1")
        await expect(service.remove("w-1", "c-1")).resolves.toBeUndefined()
        expect(connections.remove).toHaveBeenCalledWith("w-1", "c-1")
    })

    it.each([undefined, "database"] as const)("returns a live data connection filtered by %s", async (provider) => {
        const { service, connections } = await build()
        connections.find.mockResolvedValue(record)
        connections.scheduleOf.mockResolvedValue({ everyMinutes: 15, lastSyncAt: "2026-10-12T10:00:00.000Z" })
        await expect(service.own("w-1", "c-1", provider)).resolves.toEqual({
            id: "c-1",
            workspaceId: "w-1",
            provider: "database",
            name: "Orders",
            status: "connected",
            lastError: null,
            meta: { host: "db" },
            everyMinutes: 15,
            lastSyncAt: "2026-10-12T10:00:00.000Z",
        })
        expect(connections.find).toHaveBeenCalledWith("w-1", "c-1")
        expect(connections.scheduleOf).toHaveBeenCalledWith("w-1", "c-1")
    })
})

describe("DataHubService", () => {
    it.each([
        null,
        { ...record, status: "disconnected" as const },
        { ...record, provider: "telegram" as const },
        record,
    ])("refuses missing, disconnected, non-data and differently filtered connections", async (found) => {
        const { service, connections } = await build()
        connections.find.mockResolvedValue(found)
        await expect(service.own("w-1", "c-1", "imap")).rejects.toMatchObject({ code: DataHubErrorCode.NotFound })
        expect(connections.scheduleOf).not.toHaveBeenCalled()
    })

    it("creates a manual connection using connected as the default status", async () => {
        const { service, connections } = await build()
        connections.create.mockResolvedValue("new-id")
        await expect(service.create(actor, draft)).resolves.toBe("new-id")
        expect(connections.create).toHaveBeenCalledWith({
            workspaceId: "w-1",
            createdBy: "p-1",
            provider: "database",
            name: "Orders",
            status: "connected",
            environment: "live",
            meta: { host: "db" },
            secret: { plain: "secret", webhookSecret: "" },
        })
        expect(connections.setSchedule).not.toHaveBeenCalled()
    })

    it.each([5, 10080])("creates a pending connection with the accepted %s minute boundary", async (everyMinutes) => {
        const { service, connections } = await build()
        connections.create.mockResolvedValue("new-id")
        await expect(service.create(actor, { ...draft, everyMinutes, status: "pending" })).resolves.toBe("new-id")
        expect(connections.create).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }))
        expect(connections.setSchedule).toHaveBeenCalledWith("w-1", "new-id", everyMinutes)
    })

    it.each([1.5, 4, 10081])(
        "refuses an invalid %s minute schedule before creating or updating",
        async (everyMinutes) => {
            const { service, connections } = await build()
            await expect(service.create(actor, { ...draft, everyMinutes })).rejects.toMatchObject({
                code: DataHubErrorCode.ScheduleInvalid,
            })
            await expect(service.update("w-1", "c-1", { name: "New", meta: {}, everyMinutes })).rejects.toMatchObject({
                code: DataHubErrorCode.ScheduleInvalid,
            })
            expect(connections.create).not.toHaveBeenCalled()
            expect(connections.patch).not.toHaveBeenCalled()
            expect(connections.setSchedule).not.toHaveBeenCalled()
        },
    )
})

describe("DataHubService", () => {
    it("updates the public facts, clears failures and replaces the schedule", async () => {
        const { service, connections } = await build()
        await expect(
            service.update("w-1", "c-1", { name: "New", meta: { rows: "2" }, everyMinutes: null }),
        ).resolves.toBeUndefined()
        expect(connections.patch).toHaveBeenCalledWith("w-1", "c-1", {
            name: "New",
            meta: { rows: "2" },
            status: "connected",
            lastError: null,
        })
        expect(connections.setSchedule).toHaveBeenCalledWith("w-1", "c-1", null)
    })

    it.each([undefined, null, 15])("changes an owned connection schedule to %s", async (minutes) => {
        const { service, connections } = await build()
        connections.find.mockResolvedValue(record)
        connections.scheduleOf.mockResolvedValue({ everyMinutes: null, lastSyncAt: null })
        await expect(service.changeSchedule(actor, "c-1", minutes)).resolves.toBeUndefined()
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        expect(connections.find).toHaveBeenCalledWith("w-1", "c-1")
        expect(connections.setSchedule).toHaveBeenCalledWith("w-1", "c-1", minutes ?? null)
    })
})
