import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesFeedReadService } from "@modules/domain/agent-messages"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CONNECTION = "22222222-2222-4222-8222-222222222222"
const CALLER = { agentId: "a1", conversationId: null }
const TELEGRAM = { provider: "telegram", channel: "telegram" }

const connection = (changes: Partial<ConnectionStatusFacts> = {}): ConnectionStatusFacts => ({
    id: CONNECTION,
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    botUsername: "shop_bot",
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
    ...changes,
})

const build = async () => {
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.ofProvider.mockResolvedValue([connection()])
    const conversations = mock<AgentConversationsReadService>()
    conversations.onConnection.mockResolvedValue([
        { id: "k1", externalId: "5540123456302", visitorName: "Lan Nguyen" },
        { id: "k2", externalId: null, visitorName: null },
    ])
    const feed = mock<AgentMessagesFeedReadService>()
    feed.recentIn.mockResolvedValue([
        {
            id: "m1",
            conversationId: "k1",
            role: "user",
            body: "Gia bao nhieu? 0901234567",
            createdAt: "2026-10-30 10:12:00.123+00",
            deliveryStatus: null,
            deliveryError: null,
        },
        {
            id: "m2",
            conversationId: "k1",
            role: "agent",
            body: "Mot tram nghin",
            createdAt: "2026-10-30 10:12:30+00",
            deliveryStatus: "failed",
            deliveryError: "chat not found",
        },
        {
            id: "m3",
            conversationId: "k2",
            role: "agent",
            body: "Chao",
            createdAt: "2026-10-30 10:13:00+00",
            deliveryStatus: null,
            deliveryError: null,
        },
    ])
    const views = mock<NativeViewService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderToolsService,
            { provide: NativeViewService, useValue: views },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: AgentConversationsReadService, useValue: conversations },
            { provide: AgentMessagesFeedReadService, useValue: feed },
        ],
    }).compile()
    return { tools: moduleRef.get(ProviderToolsService), bindings, conversations, feed, views }
}

describe("ProviderToolsService connectionsOf", () => {
    it("lists the connections of the workspace under the provider", async () => {
        const { tools, bindings } = await build()

        await expect(tools.connectionsOf(WS, "telegram")).resolves.toEqual([connection()])
        expect(bindings.ofProvider).toHaveBeenCalledWith(WS, "telegram", 20)
    })

    it("refuses a workspace with no connection under the provider as not connected", async () => {
        const { tools, bindings } = await build()
        bindings.ofProvider.mockResolvedValue([])

        await expect(tools.connectionsOf(WS, "zalo_oa")).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })
})

describe("ProviderToolsService eventsOf", () => {
    it("answers when, which way, whether delivered and the customer masked, never a body or a name", async () => {
        const { tools, conversations, feed } = await build()

        const answer = await tools.eventsOf(WS, TELEGRAM, { connectionId: CONNECTION, limit: 3 })

        expect(answer).toEqual({
            events: [
                { at: "2026-10-30T10:12:00.123Z", direction: "in", delivery: "received", customerMasked: "5540…302" },
                { at: "2026-10-30T10:12:30.000Z", direction: "out", delivery: "failed", customerMasked: "5540…302" },
                { at: "2026-10-30T10:13:00.000Z", direction: "out", delivery: "pending", customerMasked: "" },
            ],
        })
        expect(JSON.stringify(answer)).not.toMatch(/Gia bao nhieu|Lan Nguyen|0901234567|chat not found/u)
        expect(conversations.onConnection).toHaveBeenCalledWith(WS, CONNECTION, "telegram", 500)
        expect(feed.recentIn).toHaveBeenCalledWith(["k1", "k2"], 3)
    })

    it("answers not found for a connection the workspace does not hold, before reading any conversation", async () => {
        const { tools, conversations } = await build()

        await expect(
            tools.eventsOf(WS, TELEGRAM, { connectionId: "33333333-3333-4333-8333-333333333333", limit: 5 }),
        ).rejects.toMatchObject({ code: McpGatewayErrorCode.NativeRefused, params: { reason: "not_found" } })
        expect(conversations.onConnection).not.toHaveBeenCalled()
    })

    it("refuses a workspace with no connection as not connected", async () => {
        const { tools, bindings } = await build()
        bindings.ofProvider.mockResolvedValue([])

        await expect(tools.eventsOf(WS, TELEGRAM, { connectionId: CONNECTION, limit: 5 })).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
    })

    it("answers no event for a connection with no conversation", async () => {
        const { tools, conversations, feed } = await build()
        conversations.onConnection.mockResolvedValue([])
        feed.recentIn.mockResolvedValue([])

        await expect(tools.eventsOf(WS, TELEGRAM, { connectionId: CONNECTION, limit: 5 })).resolves.toEqual({
            events: [],
        })
    })
})

describe("ProviderToolsService answer", () => {
    const route = {
        provider: "telegram",
        channel: "telegram",
        line: (found: ConnectionStatusFacts) => ({ id: found.id, handle: found.botUsername }),
    }

    it("answers the status of the connections as the route words them", async () => {
        const { tools } = await build()

        await expect(tools.answer(WS, route, "status", {}, CALLER)).resolves.toEqual({
            connections: [{ id: CONNECTION, handle: "shop_bot" }],
        })
    })

    it("answers the events of a channel connection", async () => {
        const { tools } = await build()

        await expect(
            tools.answer(WS, route, "events", { connectionId: CONNECTION, limit: 1 }, CALLER),
        ).resolves.toMatchObject({ events: expect.any(Array) })
    })

    it("refuses invalid arguments before reading anything", async () => {
        const { tools, bindings } = await build()

        await expect(tools.answer(WS, route, "status", { x: 1 }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool: "status" },
        })
        await expect(tools.answer(WS, route, "events", { connectionId: "c1" }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        expect(bindings.ofProvider).not.toHaveBeenCalled()
    })

    it("knows no events for a provider that is no channel, and no other tool", async () => {
        const { tools } = await build()

        await expect(
            tools.answer(WS, { ...route, channel: null }, "events", { connectionId: CONNECTION }, CALLER),
        ).rejects.toMatchObject({ code: McpGatewayErrorCode.UnknownTool, params: { tool: "events" } })
        await expect(tools.answer(WS, route, "send", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })

    it("refuses a caller the view policy keeps out before reading a connection", async () => {
        const { tools, bindings, views } = await build()
        views.internalOf.mockRejectedValue(nativeRefusal("internal_only"))

        await expect(tools.answer(WS, route, "status", {}, { agentId: "a1", conversationId: "c1" })).rejects.toMatchObject({
            params: { reason: "internal_only" },
        })
        expect(views.internalOf).toHaveBeenCalledWith(WS, { agentId: "a1", conversationId: "c1" })
        expect(bindings.ofProvider).not.toHaveBeenCalled()
    })
})
