import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesFeedReadService } from "@modules/domain/agent-messages"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { TelegramPageService } from "./telegram-page.service"

const actor: ConnectionActor = { principalId: "manager-1", workspaceId: "ws-1" }

const connection = builder<ConnectionRecord>({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "telegram",
    name: "Bot CSKH",
    meta: { bot_id: "42", bot_username: "shop_bot" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: "2026-10-28T09:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    createdBy: "owner-1",
    firstEvent: null,
})

const build = async (record: Partial<ConnectionRecord> = {}) => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "manager", displayName: "Minh" })
    connections.get.mockImplementation((workspaceId, id) => Promise.resolve(connection({ id, workspaceId, ...record })))
    connections.webhookUrl.mockImplementation((provider, id) => `https://hooks.test/${provider}/${id}`)
    connections.agentIds.mockResolvedValue(["agent-1"])
    const conversations = mock<AgentConversationsReadService>()
    conversations.onConnection.mockResolvedValue([{ id: "k-1", externalId: "6201234118", visitorName: "An" }])
    const feed = mock<AgentMessagesFeedReadService>()
    feed.recentIn.mockResolvedValue([
        {
            id: "m-1",
            conversationId: "k-1",
            role: "user",
            body: "private text",
            createdAt: "2026-10-28T09:00:00.000Z",
            deliveryStatus: null,
            deliveryError: null,
        },
    ])
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramPageService,
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentConversationsReadService, useValue: conversations },
            { provide: AgentMessagesFeedReadService, useValue: feed },
        ],
    }).compile()
    return { service: moduleRef.get(TelegramPageService), connections, conversations, feed }
}

describe("TelegramPageService view", () => {
    it("answers the page to an owner or a manager", async () => {
        const { service, connections } = await build()

        await expect(service.view(actor, "c-1")).resolves.toEqual({
            id: "c-1",
            name: "Bot CSKH",
            status: "connected",
            healthy: true,
            botUsername: "shop_bot",
            webhookUrl: "https://hooks.test/telegram/c-1",
            lastError: null,
            lastEventAt: "2026-10-28T09:00:00.000Z",
            agentIds: ["agent-1"],
        })
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner", "manager"])
    })

    it("calls a connection with an error unhealthy and keeps its code for the page to word", async () => {
        const { service } = await build({ status: "error", lastError: "webhook_refused", meta: {} })

        await expect(service.view(actor, "c-1")).resolves.toMatchObject({
            healthy: false,
            botUsername: "",
            lastError: "webhook_refused",
        })
    })

    it("refuses staff before reading anything", async () => {
        const { service, connections } = await build()
        const refusal = new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
        connections.authorize.mockRejectedValue(refusal)

        await expect(service.view(actor, "c-1")).rejects.toBe(refusal)
        expect(connections.get).not.toHaveBeenCalled()
    })

    it("answers not found for a connection of another provider", async () => {
        const { service } = await build({ provider: "zalo_oa" })

        await expect(service.view(actor, "c-1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
    })

    it("answers not found for an id the workspace does not have", async () => {
        const { service, connections } = await build()
        connections.get.mockRejectedValue(new ConnectionsError({ code: ConnectionsErrorCode.NotFound }))

        await expect(service.view(actor, "foreign")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
    })
})

describe("TelegramPageService events", () => {
    it("lists the events with the chat id hidden and no message text", async () => {
        const { service, conversations } = await build()

        const events = await service.events(actor, "c-1")

        expect(events).toEqual([
            {
                id: "m-1",
                kind: "user_message",
                outcome: "received",
                at: "2026-10-28T09:00:00.000Z",
                who: "6201…118",
                reason: null,
            },
        ])
        expect(JSON.stringify(events)).not.toContain("private text")
        expect(conversations.onConnection).toHaveBeenCalledWith("ws-1", "c-1", "telegram", 500)
    })

    it("refuses staff", async () => {
        const { service, connections } = await build()
        connections.authorize.mockRejectedValue(new ConnectionsError({ code: ConnectionsErrorCode.Forbidden }))

        await expect(service.events(actor, "c-1")).rejects.toMatchObject({ code: ConnectionsErrorCode.Forbidden })
    })

    it("answers not found for a connection of another provider", async () => {
        const { service } = await build({ provider: "sepay" })

        await expect(service.events(actor, "c-1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
    })
})
