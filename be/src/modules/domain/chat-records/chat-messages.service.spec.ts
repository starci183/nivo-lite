import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { CHAT_WORKSPACE, addConversation, fakeChat } from "../../../tests/fixtures/builders/chat-records.builder"
import type { FakeChat } from "../../../tests/fixtures/builders/chat-records.builder"
import { ChatEntitiesService } from "./chat-entities.service"
import { ChatMessagesService } from "./chat-messages.service"
import { CHAT_DELIVERY_UNKNOWN } from "./delivery.policy"
import { ChatRecordsErrorCode } from "./errors/chat-records.error"
import { chatStampOf } from "./message-stamp.policy"

const NOW = "2026-11-06T03:00:00.000Z"
const NOT_STORED = { code: ChatRecordsErrorCode.NotStored }
const NOT_FOUND = { code: ChatRecordsErrorCode.NotFound }
const INVALID = () => Promise.resolve({ ok: false, reason: "invalid" } as const)
const TAKEN = () => Promise.resolve({ ok: false, reason: "taken", constraint: "k", refusal: "r" } as const)

const setup = async () => {
    const chat = fakeChat()
    const entities = mock<ChatEntitiesService>()
    entities.run.mockImplementation((_workspace, work) => work(chat.api))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatMessagesService,
            { provide: ChatEntitiesService, useValue: entities },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    const conversation = await addConversation(chat)
    return { chat, service: moduleRef.get(ChatMessagesService), conversation }
}

const dataOf = (chat: FakeChat, entity: string, id: string): Readonly<Record<string, unknown>> =>
    chat.rows.get(entity)?.get(id)?.data ?? {}

describe("ChatMessagesService: customer lines", () => {
    it("stores what the customer wrote once per channel id and moves the tail of the conversation", async () => {
        const { chat, service, conversation } = await setup()
        const first = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "hello shop", "tg:1:1", null)
        const again = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "hello shop", "tg:1:1", null)
        expect(first.stored).toBe(true)
        expect(again).toEqual({ id: first.id, stored: false })
        expect(dataOf(chat, "chat.message", first.id)).toMatchObject({
            role: "user",
            text: "hello shop",
            sentAt: NOW,
            channelRef: "tg:1:1",
        })
        expect(dataOf(chat, "chat.conversation", conversation.id)).toMatchObject({
            lastText: "hello shop",
            lastRole: "user",
            lastAt: NOW,
            messageCount: 1,
        })
        expect(chat.links.get(`chat.message:${first.id}:conversation`)).toBe(conversation.id)
    })

    it("stores a line the channel timed itself at that time with its tie-break", async () => {
        const { chat, service, conversation } = await setup()
        const stamp = chatStampOf(Date.parse("2026-11-06T02:00:00.123Z"), Date.parse(NOW), "tg:1:2")
        const stored = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "hi", "tg:1:2", stamp)
        expect(dataOf(chat, "chat.message", stored.id)["sentAt"]).toMatch(/^2026-11-06T02:00:00\.123\d{3}Z$/u)
    })

    it("stores a line with no channel id every time and answers the stored one when another writer was first", async () => {
        const { chat, service, conversation } = await setup()
        const a = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "a", null, null)
        const b = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "b", null, null)
        expect(a.id).not.toBe(b.id)
        const row = { conversationId: conversation.id, role: "user", text: "c", sentAt: NOW, channelRef: "tg:9" }
        chat.takenOnce("chat.message", row)
        expect((await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "c", "tg:9", null)).stored).toBe(false)
    })

    it("refuses a line the engine neither stores nor reports taken, and a taken one it cannot find", async () => {
        const { chat, service, conversation } = await setup()
        chat.api.insert = INVALID
        await expect(service.storeCustomer(CHAT_WORKSPACE, conversation.id, "a", null, null)).rejects.toMatchObject(
            NOT_STORED,
        )
        chat.api.insert = TAKEN
        await expect(
            service.storeCustomer(CHAT_WORKSPACE, conversation.id, "a", "tg:none", null),
        ).rejects.toMatchObject(NOT_STORED)
        await expect(service.storeCustomer(CHAT_WORKSPACE, conversation.id, "a", null, null)).rejects.toMatchObject(
            NOT_STORED,
        )
    })

    it("fails when the conversation of the line is gone, keeps losing the race, or is refused", async () => {
        const { chat, service, conversation } = await setup()
        await expect(service.storeCustomer(CHAT_WORKSPACE, "gone", "a", null, null)).rejects.toMatchObject(NOT_FOUND)
        chat.staleFor("chat.conversation", 3)
        await expect(service.storeCustomer(CHAT_WORKSPACE, conversation.id, "a", null, null)).rejects.toMatchObject(
            NOT_STORED,
        )
        chat.staleFor("chat.conversation", 1)
        await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "b", null, null)
        chat.api.update = INVALID
        await expect(service.storeCustomer(CHAT_WORKSPACE, conversation.id, "c", null, null)).rejects.toMatchObject(
            NOT_STORED,
        )
    })
})

describe("ChatMessagesService: agent and system lines", () => {
    const agentLine = (conversationId: string, key: string, body = "yes") => ({
        workspaceId: CHAT_WORKSPACE,
        conversationId,
        body,
        key,
    })

    it("stores the agent line once under its key and answers the stored one the second time", async () => {
        const { chat, service, conversation } = await setup()
        const first = await service.storeAgentLine(agentLine(conversation.id, "m1"))
        const second = await service.storeAgentLine(agentLine(conversation.id, "m1", "other"))
        expect(first).toEqual({ id: second.id, body: "yes", sent: false })
        expect(second.body).toBe("yes")
        expect(dataOf(chat, "chat.message", first.id)).toMatchObject({
            role: "agent",
            authorKind: "ai",
            channelRef: "line:m1",
        })
        expect(dataOf(chat, "chat.conversation", conversation.id)).toMatchObject({ lastRole: "agent", messageCount: 1 })
    })

    it("marks a person line with its author and links it to the customer message it answers", async () => {
        const { chat, service, conversation } = await setup()
        const customer = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "q", "tg:1", null)
        const reply = await service.storeAgentLine({
            ...agentLine(conversation.id, customer.id, "a"),
            inReplyTo: customer.id,
            human: { name: "Lan", userId: "66666666-6666-4666-8666-666666666666" },
        })
        expect(dataOf(chat, "chat.message", reply.id)).toMatchObject({
            authorKind: "human",
            authorName: "Lan",
            inReplyTo: customer.id,
        })
        expect(await service.replyExists(CHAT_WORKSPACE, conversation.id, customer.id)).toBe(true)
        expect(await service.storedReply(CHAT_WORKSPACE, conversation.id, customer.id, null)).toBe("a")
        expect(await service.storedReply(CHAT_WORKSPACE, conversation.id, customer.id, customer.id)).toBe("a")
        expect(await service.storedReply(CHAT_WORKSPACE, conversation.id, "none", null)).toBeNull()
        expect(await service.replyExists(CHAT_WORKSPACE, conversation.id, "none")).toBe(false)
    })

    it("answers the reply another writer stored first, found by its key or by the customer message", async () => {
        const { chat, service, conversation } = await setup()
        const stored = { conversationId: conversation.id, role: "agent", text: "first", sentAt: NOW }
        chat.takenOnce("chat.message", { ...stored, channelRef: "line:k", deliveryStatus: "sent" })
        expect(await service.storeAgentLine(agentLine(conversation.id, "k", "second"))).toMatchObject({
            body: "first",
            sent: true,
        })
        chat.takenOnce("chat.message", { ...stored, channelRef: null, inReplyTo: "m-1" })
        const reply = await service.storeAgentLine({ ...agentLine(conversation.id, "k2"), inReplyTo: "m-1" })
        expect(reply).toMatchObject({ body: "first", sent: false })
    })

    it("refuses a taken reply it cannot find", async () => {
        const { chat, service, conversation } = await setup()
        chat.api.insert = TAKEN
        await expect(service.storeAgentLine(agentLine(conversation.id, "k3"))).rejects.toMatchObject(NOT_STORED)
        await expect(
            service.storeAgentLine({ ...agentLine(conversation.id, "k4"), inReplyTo: "zz" }),
        ).rejects.toMatchObject(NOT_STORED)
    })

    it("stores a system line that is not the preview once someone spoke", async () => {
        const { chat, service, conversation } = await setup()
        await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "hello", null, null)
        await service.storeLine(CHAT_WORKSPACE, conversation.id, "Lan took over")
        expect(dataOf(chat, "chat.conversation", conversation.id)).toMatchObject({ lastText: "hello", messageCount: 1 })
    })
})

describe("ChatMessagesService: reads", () => {
    it("finds one message of the conversation, and refuses another conversation or a missing one", async () => {
        const { service, conversation } = await setup()
        const stored = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "hi", null, null)
        expect(await service.find(CHAT_WORKSPACE, conversation.id, stored.id)).toEqual({
            kind: "ok",
            value: { id: stored.id, role: "user", body: "hi", deliveryStatus: null },
        })
        expect(await service.find(CHAT_WORKSPACE, "other", stored.id)).toMatchObject({ kind: "refused" })
        expect(await service.find(CHAT_WORKSPACE, conversation.id, "gone")).toMatchObject({ kind: "refused" })
    })

    it("lists the customer lines among ids, the unanswered ones after the last reply and the transcript", async () => {
        const { chat, service, conversation } = await setup()
        const insert = chat.api.insert
        let tick = 0
        chat.api.insert = (entity, values, links) => {
            tick += 1
            return insert(entity, { ...values, sentAt: `2026-11-06T04:00:0${tick}.000Z` }, links)
        }
        const one = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "one", null, null)
        await service.storeAgentLine({
            workspaceId: CHAT_WORKSPACE,
            conversationId: conversation.id,
            body: "reply",
            key: "r1",
        })
        const two = await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "two", null, null)
        await service.storeLine(CHAT_WORKSPACE, conversation.id, "notice")
        const among = await service.customerLinesOf(CHAT_WORKSPACE, conversation.id, [two.id, one.id, "gone"])
        expect(among.map((line) => line.body)).toEqual(["one", "two"])
        expect(await service.customerLinesOf(CHAT_WORKSPACE, conversation.id, [])).toEqual([])
        const unanswered = await service.unansweredLinesOf(CHAT_WORKSPACE, conversation.id, 10)
        expect(unanswered.map((line) => line.body)).toEqual(["two"])
        expect(await service.transcript(CHAT_WORKSPACE, conversation.id)).toEqual([
            { role: "user", body: "one" },
            { role: "agent", body: "reply" },
            { role: "user", body: "two" },
        ])
        expect(await service.lastCustomerAt(CHAT_WORKSPACE, conversation.id)).toEqual({
            kind: "ok",
            value: new Date("2026-11-06T04:00:03.000Z"),
        })
    })

    it("lists every customer line when the agent never replied, and refuses a last time before the customer wrote", async () => {
        const { service, conversation } = await setup()
        expect(await service.lastCustomerAt(CHAT_WORKSPACE, conversation.id)).toMatchObject({ kind: "refused" })
        await service.storeCustomer(CHAT_WORKSPACE, conversation.id, "a", null, null)
        const lines = await service.unansweredLinesOf(CHAT_WORKSPACE, conversation.id, 10)
        expect(lines.map((line) => line.body)).toEqual(["a"])
    })

    it("skips records that hold no line fields", async () => {
        const { chat, service, conversation } = await setup()
        const junk = await chat.api.insert("chat.message", { conversationId: conversation.id, role: "user" })
        expect(await service.transcript(CHAT_WORKSPACE, conversation.id)).toEqual([])
        expect(await service.customerLinesOf(CHAT_WORKSPACE, conversation.id, [junk.ok ? junk.row.id : ""])).toEqual([])
        expect(await service.storedReply(CHAT_WORKSPACE, conversation.id, "m", null)).toBeNull()
    })
})

describe("ChatMessagesService: delivery", () => {
    const stored = async () => {
        const world = await setup()
        const line = { workspaceId: CHAT_WORKSPACE, conversationId: world.conversation.id, body: "hi", key: "d1" }
        return { ...world, id: (await world.service.storeAgentLine(line)).id, line }
    }

    it("grants one attempt, then holds the next as unknown until a verdict is written", async () => {
        const { chat, service, conversation, id } = await stored()
        expect(await service.claimDelivery(CHAT_WORKSPACE, conversation.id, id)).toBe("send")
        expect(dataOf(chat, "chat.message", id)).toMatchObject({
            deliveryStatus: "failed",
            deliveryError: CHAT_DELIVERY_UNKNOWN,
        })
        expect(await service.claimDelivery(CHAT_WORKSPACE, conversation.id, id)).toBe("ambiguous")
        await service.markDelivery(CHAT_WORKSPACE, id, true)
        expect(dataOf(chat, "chat.message", id)).toMatchObject({ deliveryStatus: "sent", deliveryError: null })
        expect(await service.claimDelivery(CHAT_WORKSPACE, conversation.id, id)).toBe("acknowledged")
    })

    it("answers missing for a message of another conversation or none, and for a write the engine lost", async () => {
        const { chat, service, conversation, id } = await stored()
        expect(await service.claimDelivery(CHAT_WORKSPACE, "other", id)).toBe("missing")
        expect(await service.claimDelivery(CHAT_WORKSPACE, conversation.id, "gone")).toBe("missing")
        chat.api.update = () => Promise.resolve({ ok: false, reason: "missing" })
        expect(await service.claimDelivery(CHAT_WORKSPACE, conversation.id, id)).toBe("missing")
    })

    it("claims again after a stale answer and gives up as ambiguous after three", async () => {
        const { chat, service, conversation, id, line } = await stored()
        chat.staleFor("chat.message", 1)
        expect(await service.claimDelivery(CHAT_WORKSPACE, conversation.id, id)).toBe("send")
        const second = await service.storeAgentLine({ ...line, key: "d2", body: "b" })
        chat.staleFor("chat.message", 3)
        expect(await service.claimDelivery(CHAT_WORKSPACE, conversation.id, second.id)).toBe("ambiguous")
    })

    it("writes a failed verdict with its reason and restarts after a stale answer", async () => {
        const { chat, service, id } = await stored()
        await service.markDelivery(CHAT_WORKSPACE, id, false)
        expect(dataOf(chat, "chat.message", id)).toMatchObject({
            deliveryStatus: "failed",
            deliveryError: "delivery_failed",
        })
        chat.staleFor("chat.message", 1)
        await service.markDelivery(CHAT_WORKSPACE, id, false, "zalo_error")
        expect(dataOf(chat, "chat.message", id)).toMatchObject({ deliveryError: "zalo_error" })
    })

    it("refuses a verdict for a missing message, after three lost races and for a refused write", async () => {
        const { chat, service, id } = await stored()
        await expect(service.markDelivery(CHAT_WORKSPACE, "gone", true)).rejects.toMatchObject(NOT_FOUND)
        chat.staleFor("chat.message", 3)
        await expect(service.markDelivery(CHAT_WORKSPACE, id, true)).rejects.toMatchObject(NOT_STORED)
        chat.api.update = INVALID
        await expect(service.markDelivery(CHAT_WORKSPACE, id, true)).rejects.toMatchObject(NOT_STORED)
    })
})
