import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/blocks-core"
import { ChannelDeliveryService, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatHumanConversation, ChatTurnConversation } from "@modules/domain/chat-records"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
import type { NodeDataPort, NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelSendExecutorService } from "./channel-send-executor.service"
import { ChatLineMediaService } from "./chat-line-media.service"
import { CustomerDraftsService } from "./customer-drafts.service"
import { ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const NOW = new Date("2026-11-04T10:00:00.000Z")

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi",
}

const AGENT: ChatTurnConversation["agent"] = {
    id: "a-1",
    name: "Chatbot",
    handle: "chatbot",
    role: "Customer chat",
    module: "chatbot",
    instructions: "Be kind",
    knowledge: "Tea",
    approvalRule: "",
    greeting: "Hi",
}

const conversation = (overrides: Partial<ChatTurnConversation> = {}): ChatTurnConversation => ({
    id: "c1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555",
    connectionId: "k1",
    leadId: "l1",
    handledBy: null,
    visitorName: "An",
    installationId: null,
    agent: AGENT,
    speaksAs: null,
    ...overrides,
})

const human = (id: string, channel: string): ChatHumanConversation => ({
    id,
    workspaceId: "ws-1",
    channel,
    externalId: "555",
    connectionId: "k1",
    leadId: "l1",
    handledBy: null,
})

const WHERE = { conversationId: "c1", channel: "telegram", connectionId: "k1" }

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const conversations = mock<ChatConversationsService>()
    const messages = mock<ChatMessagesService>()
    const delivery = mock<ChannelDeliveryService>()
    const drafts = mock<CustomerDraftsService>()
    const media = mock<ChatLineMediaService>()
    const logger = mock<Logger>()
    const leads = mock<NodeDataPort>()
    const team = mock<NodeEffectExecutor>()
    const access = mock<ProviderAbilitiesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelSendExecutorService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: CustomerDraftsService, useValue: drafts },
            { provide: ChatLineMediaService, useValue: media },
            { provide: ProviderAbilitiesService, useValue: access },
        ],
    }).compile()
    conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation() })
    messages.storeAgentLine.mockResolvedValue({ id: "m1", body: "Hello", sent: false })
    messages.lastCustomerAt.mockResolvedValue({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
    delivery.deliver.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })
    media.resolved.mockImplementation((_turn, asked) =>
        Promise.resolve({ conversationId: asked.conversationId, text: asked.text }),
    )
    media.of.mockResolvedValue({})
    leads.read.mockResolvedValue([{ consultFacts: {} }])
    registry.portOf.mockReturnValue(leads)
    team.execute.mockResolvedValue({ kind: "chat-message", id: "team-1" })
    registry.optionalExecutorOf.mockImplementation((effect) => (effect === TOOL.teamMessagePost ? team : undefined))
    access.judge.mockResolvedValue({ kind: "allow", provider: "telegram", ability: "customer.send", connectionId: "k1" })
    drafts.draftOf.mockResolvedValue(null)
    drafts.propose.mockResolvedValue({ id: "d1", status: "proposed", text: "Hello" })
    const executor = moduleRef.get(ChannelSendExecutorService)
    return { executor, registry, conversations, messages, delivery, drafts, media, logger, leads, team, access }
}

const SEND = { conversationId: "c1", text: "Hello" }
const CALL = { key: "run:1", dedupeKey: null }

describe("ChannelSendExecutorService sending", () => {
    it("registers the one customer send", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(executor.effect).toBe(TOOL.customerMessageSend)
        expect(registry.addExecutor).toHaveBeenCalledWith(executor)
    })

    it("stores the line under the call's key, pushes it and answers the message with the channel, the connection and the verdict", async () => {
        const { executor, messages, delivery } = await build()

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({
            kind: "message",
            id: "m1",
            facts: { ...WHERE, delivery: "delivered" },
        })
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "c1",
            body: "Hello",
            key: "run:1",
            sentBy: "a-1",
        })
        expect(delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "c1",
            messageId: "m1",
            text: "Hello",
        })
    })

    it("builds the order card and the pictures from the ids the caller names", async () => {
        const { executor, media } = await build()

        await executor.execute(TURN, { ...SEND, orderId: "o1", catalogueItemIds: ["i1"] }, CALL)

        expect(media.resolved).toHaveBeenCalledWith(TURN, {
            conversationId: "c1",
            text: "Hello",
            orderId: "o1",
            catalogueItemIds: ["i1"],
        })
    })

    it("throws on a payload that addresses nobody or has no words", async () => {
        const { executor } = await build()
        await expect(executor.execute(TURN, { text: "Hello" }, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.InvalidPayload,
        })
        await expect(executor.execute(TURN, { conversationId: "c1", text: "" }, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.InvalidPayload,
        })
    })

    it("answers an unknown verdict as sent with delivery unknown, so a retry never says it twice", async () => {
        const { executor, delivery } = await build()
        delivery.deliver.mockResolvedValue({ delivered: false, failure: null, outcome: "ambiguous" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({
            kind: "message",
            id: "m1",
            facts: { ...WHERE, delivery: "unknown" },
        })
    })
})

describe("ChannelSendExecutorService rules", () => {
    it.each([
        ["conversation_missing", (world: Awaited<ReturnType<typeof build>>) => {
            world.conversations.turnOf.mockResolvedValue({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
        }],
        ["held_by_person", (world: Awaited<ReturnType<typeof build>>) => {
            world.conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ handledBy: "Thu Ha" }) })
        }],
        ["not_speaking", (world: Awaited<ReturnType<typeof build>>) => {
            world.conversations.turnOf.mockResolvedValue({
                kind: "ok",
                value: conversation({ agent: { ...AGENT, id: "a-2" } }),
            })
        }],
        ["connection_missing", (world: Awaited<ReturnType<typeof build>>) => {
            world.conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ connectionId: null }) })
        }],
    ])("answers the refusal %s as a fact and stores nothing", async (reason, arrange) => {
        const world = await build()
        arrange(world)

        await expect(world.executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "refused", id: reason })
        expect(world.messages.storeAgentLine).not.toHaveBeenCalled()
        expect(world.delivery.deliver).not.toHaveBeenCalled()
    })

})

describe("ChannelSendExecutorService who may speak", () => {
    it("refuses another conversation than the one the run serves", async () => {
        const { executor, conversations, messages } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ id: "c9" }) })

        await expect(executor.execute(TURN, { conversationId: "c9", text: "Hi" }, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "wrong_conversation",
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })

    it("lets the agent the conversation's agent handed it to speak, and no one else", async () => {
        const { executor, conversations } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ agent: { ...AGENT, id: "a-2" } }) })

        await expect(executor.execute({ ...TURN, handedOffBy: "a-2" }, SEND, CALL)).resolves.toMatchObject({
            kind: "message",
        })
        await expect(executor.execute({ ...TURN, handedOffBy: "a-3" }, SEND, CALL)).resolves.toMatchObject({
            id: "not_speaking",
        })
    })

})

describe("ChannelSendExecutorService reaching the customer", () => {
    it("refuses on Zalo after the free window, before anything is stored, and sends inside it", async () => {
        const { executor, conversations, messages } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ channel: "zalo", externalId: "123" }) })
        messages.lastCustomerAt.mockResolvedValue({
            kind: "ok",
            value: new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS - 1),
        })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "outside_window",
            facts: { channel: "zalo" },
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()

        messages.lastCustomerAt.mockResolvedValue({ kind: "ok", value: new Date(NOW.getTime() - 1000) })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "message" })
    })

    it("keeps the line marked not sent and refuses when the channel knows no recipient (no id, an imported placeholder)", async () => {
        const { executor, conversations, messages, delivery } = await build()
        for (const value of [conversation({ externalId: null }), conversation({ channel: "zalo", externalId: "imp-x" })]) {
            conversations.turnOf.mockResolvedValue({ kind: "ok", value })

            await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
                kind: "refused",
                id: "recipient_not_linked",
                facts: { messageId: "m1", delivery: "not_delivered" },
            })
        }
        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "m1", false, "recipient_not_linked")
        expect(delivery.deliver).not.toHaveBeenCalled()
    })
})

describe("ChannelSendExecutorService channel verdicts", () => {
    it.each([
        ["channel_plan", "plan_blocked"],
        ["zalo_recipient", "recipient_not_linked"],
        [null, "not_delivered"],
    ] as const)("answers a rejection for %s as the refusal %s", async (failure, reason) => {
        const { executor, delivery } = await build()
        delivery.deliver.mockResolvedValue({ delivered: false, failure, outcome: "rejected" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: reason,
            facts: { ...WHERE, messageId: "m1", delivery: "not_delivered" },
        })
    })

    it("throws for a channel that is not taking messages for now, so the run engine tries again", async () => {
        const { executor, delivery } = await build()
        delivery.deliver.mockResolvedValue({ delivered: false, failure: "zalo_quota", outcome: "rejected" })

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryRateLimited,
        })
    })
})

describe("ChannelSendExecutorService addressed by the customer", () => {
    it("writes to the customer's most recently active conversation, or the one on the channel asked for", async () => {
        const { executor, conversations } = await build()
        conversations.ofLeads.mockResolvedValue([human("c1", "telegram"), human("c2", "zalo")])
        const turn = { ...TURN, conversationId: null }

        await executor.execute(turn, { leadId: "l1", text: "Hello" }, CALL)
        expect(conversations.turnOf).toHaveBeenLastCalledWith("ws-1", "c1")

        await executor.execute(turn, { leadId: "l1", text: "Hello", channel: "zalo" }, CALL)
        expect(conversations.turnOf).toHaveBeenLastCalledWith("ws-1", "c2")
    })

    it("speaks unprompted in a conversation another agent holds, as the shop", async () => {
        const { executor, conversations } = await build()
        conversations.ofLeads.mockResolvedValue([human("c1", "telegram")])
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ agent: { ...AGENT, id: "a-2" } }) })

        await expect(executor.execute(TURN, { leadId: "l1", text: "Hello" }, CALL)).resolves.toMatchObject({
            kind: "message",
        })
    })

    it("refuses a customer with no conversation, or none on the channel asked for, naming the channels they have", async () => {
        const { executor, conversations } = await build()
        conversations.ofLeads.mockResolvedValue([human("c1", "telegram")])

        await expect(executor.execute(TURN, { leadId: "l1", text: "Hi", channel: "zalo" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "no_conversation",
            facts: { leadId: "l1", channel: "zalo", channels: ["telegram"] },
        })
        conversations.ofLeads.mockResolvedValue([])
        await expect(executor.execute(TURN, { leadId: "l1", text: "Hi" }, CALL)).resolves.toMatchObject({
            id: "no_conversation",
        })
    })

    it("refuses an unprompted message to a customer who opted out", async () => {
        const { executor, conversations, leads, messages } = await build()
        conversations.ofLeads.mockResolvedValue([human("c1", "telegram")])
        leads.read.mockResolvedValue([{ consultFacts: { careOptOut: true } }])

        await expect(executor.execute(TURN, { leadId: "l1", text: "Hi" }, CALL)).resolves.toMatchObject({
            id: "customer_opted_out",
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })
})

describe("ChannelSendExecutorService when the owner approves first", () => {
    const asking = conversation({ agent: { ...AGENT, approvalRule: "ask" } })

    it("stores a draft, tells the owner in the team chat and answers waits_owner with the draft, sending nothing", async () => {
        const { executor, conversations, drafts, team, messages, delivery } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: asking })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({
            kind: "refused",
            id: "waits_owner",
            facts: { ...WHERE, draftId: "d1" },
        })
        expect(drafts.propose).toHaveBeenCalledWith(TURN, { conversationId: "c1", text: "Hello", key: "run:1" })
        expect(team.execute).toHaveBeenCalledWith(
            TURN,
            expect.objectContaining({ kind: "message.text", intent: "ask" }),
            { key: "run:1:owner", dedupeKey: null },
        )
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        expect(delivery.deliver).not.toHaveBeenCalled()
    })

    it("keeps waiting on a retry while the draft waits, and tells the owner once", async () => {
        const { executor, conversations, drafts, team } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: asking })
        drafts.draftOf.mockResolvedValue({ id: "d1", status: "proposed", text: "Hello" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ id: "waits_owner" })
        expect(drafts.propose).not.toHaveBeenCalled()
        expect(team.execute).not.toHaveBeenCalled()
    })

    it("sends the approved draft, in the owner's words, when the call is made again", async () => {
        const { executor, conversations, drafts, delivery } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: asking })
        drafts.draftOf.mockResolvedValue({ id: "d1", status: "posted", text: "Hello, edited" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({
            kind: "message",
            id: "d1",
            facts: { ...WHERE, delivery: "delivered" },
        })
        expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ messageId: "d1", text: "Hello, edited" }))
    })

    it("refuses when the owner turned the draft down", async () => {
        const { executor, conversations, drafts } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: asking })
        drafts.draftOf.mockResolvedValue({ id: "d1", status: "rejected", text: "Hello" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            id: "owner_rejected",
            facts: { draftId: "d1" },
        })
    })
})

describe("ChannelSendExecutorService send on the conversation's channel", () => {
    it("asks the calling agent's \"send to customer\" ability on the provider of the conversation's channel: not attached and unticked refuse, ask waits, auto sends", async () => {
        const { executor, access, messages, drafts } = await build()
        const off = { ability: "customer.send", providers: ["telegram"] }

        access.judge.mockResolvedValue({ kind: "refuse", reason: "not_attached", ...off })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({
            kind: "refused",
            id: "channel_no_access",
            facts: { ...WHERE, provider: "telegram", ability: "customer.send", reason: "not_attached" },
        })
        access.judge.mockResolvedValue({ kind: "refuse", reason: "ability_off", ...off })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "channel_no_access",
            facts: { reason: "ability_off" },
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        access.judge.mockResolvedValue({ kind: "approval", provider: "telegram", ability: "customer.send", connectionId: "k1" })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ id: "waits_owner" })
        expect(drafts.propose).toHaveBeenCalled()
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        access.judge.mockResolvedValue({ kind: "allow", provider: "telegram", ability: "customer.send", connectionId: "k1" })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "message" })
        expect(access.judge).toHaveBeenCalledWith("ws-1", TURN.agentId, TOOL.customerMessageSend, false, {
            provider: "telegram",
            connectionId: "k1",
        })
    })

    it("judges the provider of the channel the conversation is on, and no provider right at all on the website chat", async () => {
        const { executor, access, conversations } = await build()

        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ channel: "zalo", externalId: "123" }) })
        await executor.execute(TURN, SEND, CALL)
        expect(access.judge).toHaveBeenLastCalledWith("ws-1", TURN.agentId, TOOL.customerMessageSend, false, {
            provider: "zalo_oa",
            connectionId: "k1",
        })

        access.judge.mockClear()
        conversations.turnOf.mockResolvedValue({
            kind: "ok",
            value: conversation({ channel: "website", connectionId: null }),
        })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "message" })
        expect(access.judge).not.toHaveBeenCalled()
    })
})

describe("ChannelSendExecutorService composed", () => {
    it("pushes the pictures of a message the back end composed and keeps the stored line to the text", async () => {
        const { executor, conversations, messages, delivery } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ channel: "zalo", externalId: "123" }) })
        const images = [{ url: "https://api/p/1/image", caption: "Basket\n2.000 VND" }]

        await expect(executor.composed(TURN, { ...SEND, images }, CALL)).resolves.toMatchObject({ kind: "message" })
        expect(messages.storeAgentLine).toHaveBeenCalledWith(expect.objectContaining({ body: "Hello" }))
        expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ text: "Hello", images }))
    })

    it("refuses a composed message with more than ten images", async () => {
        const { executor } = await build()
        const images = Array.from({ length: 11 }, (_unused, index) => ({ url: `https://api/${String(index)}`, caption: "x" }))

        await expect(executor.composed(TURN, { ...SEND, images }, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.InvalidPayload,
        })
    })
})
