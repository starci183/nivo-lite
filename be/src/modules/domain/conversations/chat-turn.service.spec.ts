import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AgentMessagesErrorCode, AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelReceiptsService } from "@modules/domain/channel-receipts"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ChatTurnPayload } from "@modules/queues/chat-turn"
import { ChatTurnService } from "./chat-turn.service"
import { CHAT_TURN_EXTENSIONS } from "./conversations.decorators"
import type {
    CustomerTurn,
    ChatTurnExtensions,
    ChatTurnProposal,
    ChatTurnRuntime,
    CustomerOutcomes,
} from "./conversations.contracts"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"

const registerRunFromJob = () => {
    describe("runFromJob", () => {
        it("runs a chat-turn payload", async () => {
            const { service, conversations, messages, delivery, extensions } = await build()
            extensions.useRuntime(runtimeAnswering(proposal()))

            await service.runFromJob(turnPayload)

            expect(conversations.turnOf.mock.calls).toEqual([["conv-1"]])
            expect(messages.find.mock.calls).toEqual([["msg-1", "conv-1"]])
            expect(messages.storeReply.mock.calls).toEqual([["ws-1", "conv-1", "Tea is 50k", "msg-1"]])
            expect(delivery.deliver.mock.calls).toEqual([
                [{ conversationId: "conv-1", messageId: "reply-1", text: "Tea is 50k" }],
            ])
        })

        it.each([
            undefined,
            null,
            false,
            42,
            "turn",
            [],
            {},
            { ...turnPayload, kind: "other" },
            { ...turnPayload, lookupName: "false" },
        ])("ignores a payload that is not a chat turn: %p", async (payload) => {
            const { service, conversations, messages, delivery, logger } = await build()

            await service.runFromJob(payload)

            expect(conversations.turnOf.mock.calls).toEqual([])
            expect(messages.find.mock.calls).toEqual([])
            expect(messages.storeReply.mock.calls).toEqual([])
            expect(delivery.deliver.mock.calls).toEqual([])
            expect(logger.warn.mock.calls).toEqual([])
        })
    })
}

const registerRunADeliverJob = () => {
    describe("run a deliver job", () => {
        it("pushes the stored message to the customer", async () => {
            const { service, messages, delivery } = await build()
            messages.find.mockResolvedValue({
                kind: "ok",
                value: { id: "greet-1", role: "agent", body: "Welcome!", deliveryStatus: null },
            })

            await service.run(deliverPayload)

            expect(delivery.deliver).toHaveBeenCalledWith({
                conversationId: "conv-1",
                messageId: "greet-1",
                text: "Welcome!",
            })
        })

        it("does nothing for a message that is gone or already sent", async () => {
            const gone = await build({ message: false })
            const sent = await build()
            sent.messages.find.mockResolvedValue({
                kind: "ok",
                value: { id: "greet-1", role: "agent", body: "Welcome!", deliveryStatus: "sent" },
            })

            await gone.service.run(deliverPayload)
            await sent.service.run(deliverPayload)

            expect(gone.delivery.deliver).not.toHaveBeenCalled()
            expect(sent.delivery.deliver).not.toHaveBeenCalled()
        })
    })

    describe("run a turn", () => {
        registerDeliveryGuards()
        registerDeliveryFailures()
    })

    describe("when the AI cannot answer", () => {
        registerHoldingReplies()
        registerHoldingFailures()
    })
}

const registerDeliveryGuards = () => {
    it("ends without effect when the conversation or the message is gone", async () => {
        const noConversation = await build({ conversation: null })
        const noMessage = await build({ message: false })

        await noConversation.service.run(turnPayload)
        await noMessage.service.run(turnPayload)

        expect(noConversation.logger.warn).toHaveBeenCalledWith("conversations.turn.target-gone", {
            conversationId: "conv-1",
        })
        expect(noMessage.delivery.showTyping).not.toHaveBeenCalled()
    })

    it("leaves a conversation a person took over to that person, but answers one the engine itself holds", async () => {
        const person = await build({ conversation: conversation({ handledBy: "Lan" }) })
        const engine = await build({ conversation: conversation({ handledBy: "OpenClaw" }) })
        engine.extensions.useRuntime(runtimeAnswering(proposal()))

        await person.service.run(turnPayload)
        await engine.service.run(turnPayload)

        expect(person.delivery.showTyping).not.toHaveBeenCalled()
        expect(engine.delivery.deliver).toHaveBeenCalledTimes(1)
    })

    it("shows typing, hands the runtime the whole turn and sends the proposed reply once", async () => {
        const { service, messages, delivery, extensions } = await build()
        const propose = jest.fn().mockResolvedValue(proposal())
        extensions.useRuntime({ propose })

        await service.run(turnPayload)

        expect(delivery.showTyping).toHaveBeenCalledWith(conversation())
        expect(propose).toHaveBeenCalledWith({
            conversation: conversation(),
            messageId: "msg-1",
            body: "Price?",
            channelEventId: "tg:555:9",
            transcript: [{ role: "user", body: "Price?" }],
        } satisfies CustomerTurn)
        expect(messages.storeReply).toHaveBeenCalledWith("ws-1", "conv-1", "Tea is 50k", "msg-1")
        expect(delivery.deliver).toHaveBeenCalledWith({
            conversationId: "conv-1",
            messageId: "reply-1",
            text: "Tea is 50k",
        })
    })

    it("names a customer just met and keeps the name on the turn", async () => {
        const { service, conversations, extensions } = await build({ name: "Minh Tran" })
        const propose = jest.fn().mockResolvedValue(proposal())
        extensions.useRuntime({ propose })

        await service.run({ ...turnPayload, lookupName: true })

        expect(conversations.rename).toHaveBeenCalledWith("conv-1", "Minh Tran")
        expect(propose).toHaveBeenCalledWith(
            expect.objectContaining({ conversation: conversation({ visitorName: "Minh Tran" }) }),
        )
    })

    it("keeps the stored name when the channel will not say one", async () => {
        const { service, conversations, extensions } = await build()
        extensions.useRuntime(runtimeAnswering(proposal()))

        await service.run({ ...turnPayload, lookupName: true })

        expect(conversations.rename).not.toHaveBeenCalled()
    })
}

const registerDeliveryFailures = () => {
    it("writes the line that tells the owner a person must approve when the answer needs one", async () => {
        const { service, messages, extensions } = await build()
        extensions.useRuntime(runtimeAnswering(proposal({ needsHuman: true, reason: "over_authority" })))

        await service.run(turnPayload)

        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.chatNeedsHuman>")
    })

    it("lets the outcome handler decide what leaves and which lines show", async () => {
        const { service, messages, delivery, extensions } = await build()
        const outcomes = mock<CustomerOutcomes>()
        outcomes.settle.mockResolvedValue({ reply: "Fixed price 55k", send: true, lines: ["Lead handed to Sales"] })
        extensions.useRuntime(runtimeAnswering(proposal()))
        extensions.useOutcomes(outcomes)

        await service.run(turnPayload)

        expect(outcomes.settle).toHaveBeenCalledWith(expect.objectContaining({ messageId: "msg-1" }), proposal())
        expect(delivery.deliver).toHaveBeenCalledWith({
            conversationId: "conv-1",
            messageId: "reply-1",
            text: "Fixed price 55k",
        })
        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Lead handed to Sales")
    })

    it("sends nothing when the outcome handler keeps the reply for approval, and still shows its lines", async () => {
        const { service, messages, delivery, extensions } = await build()
        const outcomes = mock<CustomerOutcomes>()
        outcomes.settle.mockResolvedValue({ reply: "draft", send: false, lines: ["Waits for approval"] })
        extensions.useRuntime(runtimeAnswering(proposal()))
        extensions.useOutcomes(outcomes)

        await service.run(turnPayload)

        expect(messages.storeReply).not.toHaveBeenCalled()
        expect(delivery.deliver).not.toHaveBeenCalled()
        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Waits for approval")
    })

    it("never sends a reply twice", async () => {
        const { service, delivery, extensions } = await build({ sent: true })
        extensions.useRuntime(runtimeAnswering(proposal()))

        await service.run(turnPayload)

        expect(delivery.deliver).not.toHaveBeenCalled()
    })
}

const registerHoldingReplies = () => {
    it("sends the default holding line, remembers it and tells the owner the AI was late", async () => {
        const { service, messages, receipts, delivery } = await build()

        await service.run(turnPayload)

        expect(receipts.heldSince).toHaveBeenCalledWith("ws-1", "conv-1", new Date(NOW - 3_600_000))
        expect(messages.storeReply).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.holdingReply>", "msg-1")
        expect(delivery.deliver).toHaveBeenCalledWith({
            conversationId: "conv-1",
            messageId: "reply-1",
            text: "<conversations.holdingReply>",
        })
        expect(receipts.rememberHolding).toHaveBeenCalledWith("ws-1", "conv-1", new Date(NOW))
        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.chatUnavailable>")
    })

    it(
        "sends the owner own holding line, trimmed and bounded, and falls back to the default " +
            "when it is empty or unset",
        async () => {
            const custom = await build({ setting: [{ holdingMessage: `  ${"x".repeat(500)}  ` }] })
            const blank = await build({ setting: [{ holdingMessage: "   " }] })
            const unset = await build({ setting: [{ holdingMessage: null }] })

            await custom.service.run(turnPayload)
            await blank.service.run(turnPayload)
            await unset.service.run(turnPayload)

            expect(custom.messages.storeReply).toHaveBeenCalledWith("ws-1", "conv-1", "x".repeat(400), "msg-1")
            expect(blank.messages.storeReply).toHaveBeenCalledWith(
                "ws-1",
                "conv-1",
                "<conversations.holdingReply>",
                "msg-1",
            )
            expect(unset.messages.storeReply).toHaveBeenCalledWith(
                "ws-1",
                "conv-1",
                "<conversations.holdingReply>",
                "msg-1",
            )
        },
    )

    it("does not repeat the holding line within the hour, but still hands the question over", async () => {
        const { service, messages, delivery, receipts, extensions } = await build({ held: true })
        const outcomes = mock<CustomerOutcomes>()
        outcomes.holdOver.mockResolvedValue(["Handed to Lan"])
        extensions.useOutcomes(outcomes)

        await service.run(turnPayload)

        expect(outcomes.holdOver).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: "msg-1" }),
            "openclaw_unavailable",
        )
        expect(delivery.deliver).not.toHaveBeenCalled()
        expect(receipts.rememberHolding).not.toHaveBeenCalled()
        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Handed to Lan")
    })

    it("finishes delivering the holding line a previous attempt stored, even inside the hour", async () => {
        const { service, delivery } = await build({ retry: true, held: true })

        await service.run(turnPayload)

        expect(delivery.deliver).toHaveBeenCalledTimes(1)
    })
}

const registerHoldingFailures = () => {
    it("falls back the same way when the AI step throws, and logs it", async () => {
        const { service, delivery, logger, extensions } = await build()
        const failure = new Error("gateway down")
        extensions.useRuntime({ propose: () => Promise.reject(failure) })

        await service.run(turnPayload)

        expect(logger.error).toHaveBeenCalledWith("conversations.runtime.failed", failure, {
            conversationId: "conv-1",
        })
        expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ text: "<conversations.holdingReply>" }))
    })

    it("falls back with the reason the AI step gives when it says it cannot answer", async () => {
        const { service, delivery, extensions } = await build()
        const outcomes = mock<CustomerOutcomes>()
        outcomes.holdOver.mockResolvedValue([])
        extensions.useRuntime(runtimeAnswering("too_slow"))
        extensions.useOutcomes(outcomes)

        await service.run(turnPayload)

        expect(outcomes.holdOver).toHaveBeenCalledWith(expect.anything(), "too_slow")
        expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ text: "<conversations.holdingReply>" }))
    })
}

const NOW = Date.parse("2026-10-12T10:00:00.000Z")

const conversation = (patch: Partial<TurnConversation> = {}): TurnConversation => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555",
    connectionId: "c-1",
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    installationId: null,
    agent: {
        id: "agent-1",
        name: "Chatbot",
        handle: "chatbot",
        role: "Customer chat",
        module: "chatbot",
        instructions: "Be kind",
        knowledge: "Tea",
        approvalRule: "ask",
        greeting: "Hi",
    },
    ...patch,
})

interface Setup {
    readonly conversation?: TurnConversation | null
    readonly message?: boolean
    readonly setting?: ReadonlyArray<unknown>
    readonly retry?: boolean
    readonly held?: boolean
    readonly sent?: boolean
    readonly name?: string
}

/** What the spec plugs into a turn, and when. */
interface Plugged {
    /** The AI step, once plugged. */
    runtime?: ChatTurnRuntime
    /** The outcome handler, once plugged. */
    outcomes?: CustomerOutcomes
}

/**
 * The extensions a spec can plug a runtime and an outcome handler into at any point, like the app root does at start.
 */
const pluggable = () => {
    const plugged: Plugged = {}
    return {
        runtime: () => plugged.runtime,
        outcomes: () => plugged.outcomes,
        useRuntime: (runtime: ChatTurnRuntime) => {
            plugged.runtime = runtime
        },
        useOutcomes: (outcomes: CustomerOutcomes) => {
            plugged.outcomes = outcomes
        },
    }
}

const build = async (setup: Setup = {}) => {
    const em = mockEntityManager()
    answerByTable(em, { "public.module_installations": setup.setting ?? [] })
    const conversations = mock<AgentConversationsService>()
    conversations.turnOf.mockResolvedValue(
        setup.conversation === null
            ? { kind: "refused", code: AgentConversationsErrorCode.NotFound }
            : { kind: "ok", value: setup.conversation ?? conversation() },
    )
    conversations.rename.mockResolvedValue(undefined)
    const messages = mock<AgentMessagesService>()
    messages.find.mockResolvedValue(
        setup.message === false
            ? { kind: "refused", code: AgentMessagesErrorCode.NotFound }
            : { kind: "ok", value: { id: "msg-1", role: "user", body: "Price?", deliveryStatus: null } },
    )
    messages.transcript.mockResolvedValue([{ role: "user", body: "Price?" }])
    messages.storeReply.mockImplementation((_ws, _conv, body) =>
        Promise.resolve({ id: "reply-1", body, sent: setup.sent === true }),
    )
    messages.storeLine.mockResolvedValue(undefined)
    messages.replyExists.mockResolvedValue(setup.retry === true)
    const receipts = mock<ChannelReceiptsService>()
    receipts.heldSince.mockResolvedValue(setup.held === true)
    receipts.rememberHolding.mockResolvedValue(undefined)
    const delivery = mock<ChannelDeliveryService>()
    delivery.deliver.mockResolvedValue({ delivered: true, failure: null })
    delivery.showTyping.mockResolvedValue(undefined)
    delivery.customerName.mockResolvedValue(setup.name ?? "")
    const logger = mock<Logger>()
    const extensions = pluggable()
    const catalog: MessageCatalog = { get: (key) => `<${key}>` }
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatTurnService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>(catalog) },
            { provide: CHAT_TURN_EXTENSIONS, useValue: mock<ChatTurnExtensions>(extensions) },
            { provide: LOGGER, useValue: logger },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ChannelReceiptsService, useValue: receipts },
            { provide: ChannelDeliveryService, useValue: delivery },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChatTurnService),
        em,
        conversations,
        messages,
        receipts,
        delivery,
        logger,
        extensions,
    }
}

const turnPayload: ChatTurnPayload = {
    kind: "turn",
    workspaceId: "ws-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    channelEventId: "tg:555:9",
    lookupName: false,
}

const proposal = (patch: Partial<ChatTurnProposal> = {}): ChatTurnProposal => ({
    reply: "Tea is 50k",
    needsHuman: false,
    reason: "",
    proposedAnswer: "",
    detail: {},
    ...patch,
})

const runtimeAnswering = (answer: ChatTurnProposal | string): ChatTurnRuntime => ({
    propose: () => Promise.resolve(answer),
})

const deliverPayload: ChatTurnPayload = { ...turnPayload, kind: "deliver", messageId: "greet-1" }

describe("ChatTurnService", () => {
    registerRunFromJob()
    registerRunADeliverJob()
})
