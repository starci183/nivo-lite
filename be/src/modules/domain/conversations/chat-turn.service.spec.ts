import assert from "node:assert/strict"
import {
    NOW,
    conversation,
    arrangeChatTurn,
    chatTurnExtensionsOf,
} from "@tests/fixtures/builders/chat-turn-harness.builder"
import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import { ChannelReceiptsService } from "@modules/domain/channel-receipts"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatTurnService } from "./chat-turn.service"
import { CHAT_TURN_EXTENSIONS } from "./conversations.decorators"
import type { ChatTurnExtensions, ChatTurnProposal, CustomerOutcomes, CustomerTurn } from "./conversations.contracts"

const build = async (setup: Parameters<typeof arrangeChatTurn>[1] = {}) => {
    const installations = mock<InstallationRecordsService>()
    const conversations = mock<ChatConversationsService>()
    const messages = mock<ChatMessagesService>()
    const receipts = mock<ChannelReceiptsService>()
    const delivery = mock<ChannelDeliveryService>()
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>({ get: (key) => `<${key}>` })
    const extensions = chatTurnExtensionsOf()
    const extensionPort = mock<ChatTurnExtensions>(extensions)
    const doubles = { installations, conversations, messages, receipts, delivery, logger, catalog, extensions }
    arrangeChatTurn(doubles, setup)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatTurnService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CHAT_TURN_EXTENSIONS, useValue: extensionPort },
            { provide: LOGGER, useValue: logger },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelReceiptsService, useValue: receipts },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: InstallationRecordsService, useValue: installations },
        ],
    }).compile()
    return { service: moduleRef.get(ChatTurnService), ...doubles }
}

type World = Awaited<ReturnType<typeof build>>

const turnRef = {
    conversationId: "conv-1",
    messageId: "msg-1",
    channelEventId: "tg:c-1:555:9",
}

const proposal = (patch: Partial<ChatTurnProposal> = {}): ChatTurnProposal => ({
    reply: "Tea is 50k",
    needsHuman: false,
    reason: "",
    proposedAnswer: "",
    detail: {},
    ...patch,
})

/** The turn of the stored message, which the setup must have found. */
const turnOf = async (world: World): Promise<CustomerTurn> => {
    const turn = await world.service.turnOf("ws-1", turnRef)
    assert(turn !== undefined)
    return turn
}

const registerTurnOf = () => {
    it("reads the conversation, the message and the transcript of a wake in the workspace of the wake", async () => {
        const world = await build()

        const turn = await world.service.turnOf("ws-1", turnRef)

        expect(world.conversations.turnOf).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(world.messages.find).toHaveBeenCalledWith("ws-1", "conv-1", "msg-1")
        expect(turn).toEqual({
            conversation: conversation(),
            messageId: "msg-1",
            body: "Price?",
            channelEventId: "tg:c-1:555:9",
            transcript: [{ role: "user", body: "Price?" }],
        } satisfies CustomerTurn)
    })

    it("ends without effect when the conversation or the message is gone", async () => {
        const noConversation = await build({ conversation: null })
        const noMessage = await build({ message: false })

        await expect(noConversation.service.turnOf("ws-1", turnRef)).resolves.toBeUndefined()
        await expect(noMessage.service.turnOf("ws-1", turnRef)).resolves.toBeUndefined()

        expect(noConversation.logger.warn).toHaveBeenCalledWith("conversations.turn.target-gone", {
            conversationId: "conv-1",
        })
        expect(noMessage.logger.warn).toHaveBeenCalledTimes(1)
    })

    it("reads the messages of the burst window in the same turn, oldest first, and leaves out one that is gone", async () => {
        const { service, messages } = await build()
        const found = (body: string) => ({
            kind: "ok" as const,
            value: { id: body, role: "customer", body, deliveryStatus: null },
        })
        messages.find.mockImplementation((_workspaceId, _conversationId, id) =>
            Promise.resolve(
                id === "msg-gone"
                    ? { kind: "refused" as const, code: ChatRecordsErrorCode.NotFound }
                    : found(`body of ${id}`),
            ),
        )

        const turn = await service.turnOf("ws-1", { ...turnRef, mergedMessageIds: ["msg-2", "msg-gone", "msg-3"] })

        expect(turn?.body).toBe("body of msg-1\nbody of msg-2\nbody of msg-3")
    })
}

const registerReady = () => {
    it("leaves a conversation a person took over to that person, but answers one the engine itself holds", async () => {
        const person = await build({ conversation: conversation({ handledBy: "Lan" }) })
        const engine = await build({ conversation: conversation({ handledBy: "OpenClaw" }) })
        const free = await build()

        expect(person.service.answeredByPerson(await turnOf(person))).toBe(true)
        expect(engine.service.answeredByPerson(await turnOf(engine))).toBe(false)
        expect(free.service.answeredByPerson(await turnOf(free))).toBe(false)
    })

    it("shows typing on the channel and names a customer just met, keeping the name on the turn", async () => {
        const world = await build({ name: "Minh Tran" })

        const ready = await world.service.ready(await turnOf(world), true)

        expect(world.delivery.showTyping).toHaveBeenCalledWith(conversation({ visitorName: "Minh Tran" }))
        expect(world.conversations.rename).toHaveBeenCalledWith("ws-1", "conv-1", "Minh Tran")
        expect(ready.conversation.visitorName).toBe("Minh Tran")
    })

    it("keeps the stored name when the channel will not say one, and asks no name when not asked to", async () => {
        const silent = await build()
        const unasked = await build({ name: "Minh Tran" })

        const kept = await silent.service.ready(await turnOf(silent), true)
        await unasked.service.ready(await turnOf(unasked), false)

        expect(kept.conversation).toEqual(conversation())
        expect(silent.conversations.rename).not.toHaveBeenCalled()
        expect(unasked.delivery.customerName).not.toHaveBeenCalled()
        expect(unasked.delivery.showTyping).toHaveBeenCalledTimes(1)
    })
}

const registerRespond = () => {
    it("stores the proposed reply once and delivers it through the channel", async () => {
        const world = await build()

        await world.service.respond(await turnOf(world), proposal())

        expect(world.messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            body: "Tea is 50k",
            key: "msg-1",
            inReplyTo: "msg-1",
        })
        expect(world.delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "reply-1",
            text: "Tea is 50k",
        })
    })

    it("writes the line that tells the owner a person must approve when the answer needs one", async () => {
        const world = await build()

        await world.service.respond(await turnOf(world), proposal({ needsHuman: true, reason: "over_authority" }))

        expect(world.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.chatNeedsHuman>")
    })

    it("lets the outcome handler decide what leaves and which lines show", async () => {
        const world = await build()
        const outcomes = mock<CustomerOutcomes>()
        outcomes.settle.mockResolvedValue({ reply: "Fixed price 55k", send: true, lines: ["Lead handed to Sales"] })
        world.extensions.useOutcomes(outcomes)

        await world.service.respond(await turnOf(world), proposal())

        expect(outcomes.settle).toHaveBeenCalledWith(expect.objectContaining({ messageId: "msg-1" }), proposal())
        expect(world.delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "reply-1",
            text: "Fixed price 55k",
        })
        expect(world.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Lead handed to Sales")
    })
}

const registerRespondHeld = () => {
    it("sends nothing when the outcome handler keeps the reply for approval, and still shows its lines", async () => {
        const world = await build()
        const outcomes = mock<CustomerOutcomes>()
        outcomes.settle.mockResolvedValue({ reply: "draft", send: false, lines: ["Waits for approval"] })
        world.extensions.useOutcomes(outcomes)

        await world.service.respond(await turnOf(world), proposal())

        expect(world.messages.storeAgentLine).not.toHaveBeenCalled()
        expect(world.delivery.deliver).not.toHaveBeenCalled()
        expect(world.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Waits for approval")
    })

    it("sends none of the model's text when the final reply is owed, and still shows the lines", async () => {
        const world = await build()
        const outcomes = mock<CustomerOutcomes>()
        outcomes.settle.mockResolvedValue({ reply: "Will do", send: true, lines: ["Order recorded"] })
        world.extensions.useOutcomes(outcomes)

        await world.service.respond({ ...(await turnOf(world)), finalOwed: true }, proposal())

        expect(world.messages.storeAgentLine).not.toHaveBeenCalled()
        expect(world.delivery.deliver).not.toHaveBeenCalled()
        expect(world.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Order recorded")
    })

    it("never sends a reply twice", async () => {
        const world = await build({ sent: true })

        await expect(world.service.sendReply(await turnOf(world), "Tea is 50k")).resolves.toBe("acknowledged")

        expect(world.delivery.deliver).not.toHaveBeenCalled()
    })
}

const registerSettleLate = () => {
    it("passes a late reply through the gate, shows its lines and leaves sending to the caller", async () => {
        const world = await build()
        const outcomes = mock<CustomerOutcomes>()
        outcomes.settleLate.mockResolvedValue({ reply: "Done", send: false, lines: ["Waits for approval"] })
        world.extensions.useOutcomes(outcomes)
        const turn = await turnOf(world)

        await expect(world.service.settleLate(turn, "Done", "w1")).resolves.toMatchObject({ send: false })

        expect(outcomes.settleLate).toHaveBeenCalledWith(turn, "Done", "w1")
        expect(world.delivery.deliver).not.toHaveBeenCalled()
        expect(world.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Waits for approval")
    })

    it("returns the unchanged late reply when no outcome handler is registered", async () => {
        const world = await build()

        await expect(world.service.settleLate(await turnOf(world), "Finished", "item-1")).resolves.toEqual({
            reply: "Finished",
            send: true,
            lines: [],
        })

        expect(world.messages.storeLine).not.toHaveBeenCalled()
        expect(world.messages.storeAgentLine).not.toHaveBeenCalled()
    })
}

const registerHoldOver = () => {
    it("sends the default holding line, remembers it and tells the owner the AI was late", async () => {
        const world = await build()

        await world.service.holdOver(await turnOf(world), "openclaw_unavailable")

        expect(world.receipts.heldSince).toHaveBeenCalledWith("ws-1", "conv-1", new Date(NOW - 3_600_000))
        expect(world.messages.storeAgentLine).toHaveBeenCalledWith(
            expect.objectContaining({ body: "<conversations.holdingReply>", key: "msg-1", inReplyTo: "msg-1" }),
        )
        expect(world.delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "reply-1",
            text: "<conversations.holdingReply>",
        })
        expect(world.receipts.rememberHolding).toHaveBeenCalledWith("ws-1", "conv-1", new Date(NOW))
        expect(world.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.chatUnavailable>")
    })

    it("sends the owner own holding line, trimmed and bounded, and falls back to the default when it is empty or unset", async () => {
        const custom = await build({ setting: { holdingMessage: `  ${"x".repeat(500)}  ` } })
        const blank = await build({ setting: { holdingMessage: "   " } })
        const unset = await build({ setting: { holdingMessage: null } })

        await custom.service.holdOver(await turnOf(custom), "openclaw_unavailable")
        await blank.service.holdOver(await turnOf(blank), "openclaw_unavailable")
        await unset.service.holdOver(await turnOf(unset), "openclaw_unavailable")

        expect(custom.messages.storeAgentLine).toHaveBeenCalledWith(expect.objectContaining({ body: "x".repeat(400) }))
        const holding = { body: "<conversations.holdingReply>" }
        expect(blank.messages.storeAgentLine).toHaveBeenCalledWith(expect.objectContaining(holding))
        expect(unset.messages.storeAgentLine).toHaveBeenCalledWith(expect.objectContaining(holding))
    })

    it("does not repeat the holding line within the hour, but still hands the question over", async () => {
        const world = await build({ held: true })
        const outcomes = mock<CustomerOutcomes>()
        outcomes.holdOver.mockResolvedValue(["Handed to Lan"])
        world.extensions.useOutcomes(outcomes)

        await world.service.holdOver(await turnOf(world), "openclaw_unavailable")

        expect(outcomes.holdOver).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: "msg-1" }),
            "openclaw_unavailable",
        )
        expect(world.delivery.deliver).not.toHaveBeenCalled()
        expect(world.receipts.rememberHolding).not.toHaveBeenCalled()
        expect(world.messages.storeLine).toHaveBeenCalledTimes(1)
        expect(world.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "Handed to Lan")
    })
}

const registerPaused = () => {
    it("is silent to the customer while paused, unless the owner wrote a holding message, and notes it once per burst", async () => {
        const silent = await build()
        const written = await build({ setting: { holdingMessage: "We are closed" } })
        const later = await build({ held: true })

        await silent.service.holdOver(await turnOf(silent), "installation_not_running")
        await written.service.holdOver(await turnOf(written), "installation_not_running")
        await later.service.holdOver(await turnOf(later), "installation_not_running")

        expect(silent.messages.storeAgentLine).not.toHaveBeenCalled()
        expect(silent.delivery.deliver).not.toHaveBeenCalled()
        expect(silent.receipts.rememberHolding).toHaveBeenCalledTimes(1)
        expect(silent.messages.storeLine).toHaveBeenCalledTimes(1)
        expect(silent.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.chatPaused>")
        expect(written.messages.storeAgentLine).toHaveBeenCalledWith(expect.objectContaining({ body: "We are closed" }))
        expect(written.messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.chatUnavailable>")
        expect(later.messages.storeAgentLine).not.toHaveBeenCalled()
        expect(later.messages.storeLine).not.toHaveBeenCalled()
    })

    it("finishes delivering the holding line a previous attempt stored, even inside the hour", async () => {
        const world = await build({ retry: true, held: true })

        await world.service.holdOver(await turnOf(world), "openclaw_unavailable")

        expect(world.messages.replyExists).toHaveBeenCalledWith("ws-1", "conv-1", "msg-1")
        expect(world.delivery.deliver).toHaveBeenCalledTimes(1)
    })
}

describe("ChatTurnService", () => {
    describe("turnOf", registerTurnOf)

    describe("ready", registerReady)

    describe("respond and sendReply", registerRespond)

    describe("respond when the reply is held", registerRespondHeld)

    describe("settleLate", registerSettleLate)

    describe("holdOver", registerHoldOver)

    describe("holdOver while paused or retried", registerPaused)
})
