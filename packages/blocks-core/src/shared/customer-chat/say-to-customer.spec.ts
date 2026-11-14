import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { CHATBOT_CHAT_ENTITY } from "../entities/chatbot-entity-names"
import { addConversation, fakeChat, type FakeChat } from "../../agents/chatbot/fixtures/chat-store.memory"
import {
    memoryNodeContext,
    memoryRecordTools,
    type MemoryRecordTools,
} from "../../agents/chatbot/fixtures/record-tools.memory"
import { saidOrCannot, sayToCustomer } from "./say-to-customer"
import { answered, refused } from "../nodes/tool-answers"

const QR = { url: "https://vietqr.app/img/abc", caption: "QR code\ntransfer" }

/** The receipt the engine's person-addressed send answers. */
const receiptOf = (extra: JsonObject = {}): JsonObject => ({
    delivered: true,
    state: "delivered",
    reason: null,
    contactId: "c-1",
    channel: "zalo",
    accountId: "conn-1",
    routeId: "route-1",
    providerMessageId: "zalo-msg-9",
    at: "2026-11-13T03:00:01.000Z",
    sendKey: "run-1:answer:1",
    ...extra,
})

const chatOf = (chat: FakeChat, id: string) => chat.rows.get(CHATBOT_CHAT_ENTITY)?.get(id)
const sends = (tools: MemoryRecordTools) => tools.calls.filter((call) => call.id === TOOL.customerMessageSend)
const recordCalls = (tools: MemoryRecordTools) => tools.calls.filter((call) => call.id !== TOOL.customerMessageSend)

const setup = async () => {
    const chat = fakeChat()
    const stored = await addConversation(chat, { channel: "zalo" })
    const tools = memoryRecordTools(chat)
    return { chat, tools, context: memoryNodeContext(tools), chatRef: { conversationId: stored.id } }
}

// Design moved (owner ruling R26): the conversation is the engine's; the say step writes no chatbot line. The old seam
// (`SEND_ADDRESSING`, the conversation-addressed send) is deleted under R28; a chatbot node only marks its own chat answered.
describe("sayToCustomer", () => {
    it("addresses the person: the contact, channel, account, words and pictures, never a conversation", async () => {
        const { tools, context } = await setup()
        tools.answers.set(TOOL.customerMessageSend, answered(receiptOf()))
        const said = await sayToCustomer(context, {
            text: "The price is 250k",
            contactId: "c-1",
            channel: "zalo",
            accountId: "conn-1",
            images: [QR],
        })
        expect(sends(tools)[0]?.args).toEqual({
            contactId: "c-1",
            channel: "zalo",
            accountId: "conn-1",
            text: "The price is 250k",
            images: [{ url: QR.url, caption: QR.caption }],
        })
        expect(said).toMatchObject({
            ok: true,
            receipt: { state: "delivered", sendKey: "run-1:answer:1", providerMessageId: "zalo-msg-9" },
        })
    })

    // Design moved (ruling R43): the staff hold is the ENGINE's (the route's); the chatbot reads no holder before a send (the old
    // held_by_person refusal is deleted, no dual copy) and the engine's send door answers `route_held`, which reaches the node like any refusal.
    it("R43: a chatbot node checks no holder; the engine's route_held refusal is answered to the node, its chat is not marked", async () => {
        const { tools, context, chatRef } = await setup()
        tools.answers.set(TOOL.customerMessageSend, refused("route_held", {}))
        const said = await sayToCustomer(context, { text: "Hello" }, { chat: chatRef })
        expect(said).toEqual({ ok: false, refusal: "route_held", facts: {}, declined: false })
        expect(sends(tools)).toHaveLength(1)
        expect(recordCalls(tools)).toEqual([])
    })

    it("a delivered reply of a chatbot node marks its own chat answered at the delivery; it writes no line", async () => {
        const { chat, tools, context, chatRef } = await setup()
        tools.answers.set(TOOL.customerMessageSend, answered(receiptOf()))
        await sayToCustomer(context, { text: "The price is 250k" }, { chat: chatRef })
        expect(chatOf(chat, chatRef.conversationId)?.data).toMatchObject({
            unanswered: false,
            lastAt: "2026-11-13T03:00:01.000Z",
        })
        // R43: no holder read before the send (one get, then the update).
        expect(recordCalls(tools).map((call) => call.id)).toEqual([TOOL.recordGet, TOOL.recordUpdate])
    })

    it("a refused or unknown receipt leaves the chat unanswered (the engine's line keeps the state)", async () => {
        const { tools, context, chatRef } = await setup()
        tools.answers.set(
            TOOL.customerMessageSend,
            answered(receiptOf({ state: "refused", delivered: false, reason: "outside_window", sendKey: "k-refused" })),
        )
        const said = await sayToCustomer(context, { text: "Reminder" }, { chat: chatRef })
        expect(said).toMatchObject({ ok: true, receipt: { state: "refused", reason: "outside_window" } })
        // R43: no holder read before the send, and no mark after a receipt that was not delivered.
        expect(recordCalls(tools)).toEqual([])
    })

    it("R8: a node of another agent sends and writes NO chatbot record, whatever the receipt", async () => {
        const { tools, context } = await setup()
        tools.answers.set(TOOL.customerMessageSend, answered(receiptOf()))
        const said = await sayToCustomer(context, { text: "Order DH-1 received", contactId: "c-1" })
        expect(said).toMatchObject({ ok: true, receipt: { sendKey: "run-1:answer:1" } })
        expect(recordCalls(tools)).toEqual([])
    })

    // `not_speaking` is gone with the conversation hold (R35, R43); any send refusal shows the same road.
    it("answers a refusal and a declined approval to the node, never throws them", async () => {
        const { tools, context } = await setup()
        tools.answers.set(TOOL.customerMessageSend, refused("outside_window", { channel: "zalo" }))
        const held = await sayToCustomer(context, { text: "x" })
        expect(held).toEqual({ ok: false, refusal: "outside_window", facts: { channel: "zalo" }, declined: false })
        expect(() => saidOrCannot(context, held)).toThrow(expect.objectContaining({ params: { at: expect.stringContaining("nivo.tool.customer.message.send refused: outside_window") } }))
        tools.answers.set(TOOL.customerMessageSend, { ok: false, refusal: "declined", declined: true, facts: {} })
        expect(await sayToCustomer(context, { text: "x" })).toMatchObject({ ok: false, declined: true })
    })

    it("a send answered with no receipt ends the node as cannot", async () => {
        const { tools, context, chatRef } = await setup()
        const noReceiptText: unknown = expect.stringContaining("answered no receipt")
        tools.answers.set(TOOL.customerMessageSend, answered({ messageId: "m1" }))
        await expect(sayToCustomer(context, { text: "x" }, { chat: chatRef })).rejects.toMatchObject({
            params: { at: noReceiptText },
        })
    })
})
