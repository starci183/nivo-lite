import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import {
    MANAGER_ID,
    STAFF_CONTEXT,
    conversationApi,
    conversationOf,
    memoryProvider,
    memoryWorld,
    messageApi,
    putConversation,
    recordOfThread,
} from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { CONVERSATIONS, MESSAGES } from "../ports"
import { REPLY } from "./reply.action"

const run = (world: MemoryWorld, input: unknown, memberId: string | null = STAFF_CONTEXT.memberId) =>
    REPLY.execute?.(memoryProvider(world), input, { ...STAFF_CONTEXT, memberId })

/** A provider whose port `id` is the given api, every other port the world's. */
const overriding = (world: MemoryWorld, id: string, api: object): PortProvider => {
    const base = memoryProvider(world)
    return { implementationOf: (port) => (port.id === id ? api : base.implementationOf(port)) }
}

describe("the chatbot.reply action", () => {
    it("stores the reply of the person who holds the conversation and enqueues its delivery, calling no channel", async () => {
        const world = memoryWorld()
        const result = await run(world, { id: "c2", text: "  Invoice is on its way.  " })
        expect(result).toEqual({ ok: true, data: { messageId: "m1" } })
        expect(world.lines).toEqual([
            {
                id: "m1",
                workspaceId: "w1",
                version: "1",
                createdAt: "2026-11-03T09:00:00.000Z",
                updatedAt: "2026-11-03T09:00:00.000Z",
                data: {
                    conversationId: "c2",
                    role: "agent",
                    text: "Invoice is on its way.",
                    sentAt: "2026-11-05T03:00:00.000Z",
                    authorKind: "human",
                    authorName: "Thu Ha Le",
                    authorUserId: "member-staff",
                },
            },
        ])
        expect(world.links).toContainEqual({ entity: "chat.message", id: "m1", relation: "conversation", to: "c2" })
        expect(world.jobs).toEqual([{ job: "chatbot.deliver-reply", input: { messageId: "m1" } }])
        expect(world.sends).toEqual([])
        expect(conversationOf(world, "c2")).toMatchObject({
            version: "8",
            lastText: "Invoice is on its way.",
            lastRole: "agent",
            lastAt: "2026-11-05T03:00:00.000Z",
            messageCount: 10,
            status: "handled",
            unanswered: false,
        })
    })

    it("lets a manager reply in a conversation another person holds", async () => {
        const world = memoryWorld()
        expect(await run(world, { id: "c2", text: "Hello" }, MANAGER_ID)).toMatchObject({ ok: true })
        expect(world.lines[0]?.data).toMatchObject({ authorName: "Lan Pham" })
    })

    it("refuses staff a conversation another person holds", async () => {
        const world = memoryWorld()
        putConversation(world, { ...HANDLED_ROW, handledBy: "Minh" })
        expect(await run(world, { id: "c2", text: "Hello" })).toEqual({
            ok: false,
            reason: "forbidden",
            message: { key: "reply_held_by_other" },
        })
        expect(world.lines).toEqual([])
    })

    it("asks to take the conversation over first when nobody holds it", async () => {
        expect(await run(memoryWorld(), { id: "c3", text: "Hello" })).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "reply_not_held" },
        })
    })

    it("refuses a conversation the workspace does not have", async () => {
        expect(await run(memoryWorld(), { id: "nope", text: "Hello" })).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "reply_not_found" },
        })
    })

    it("refuses an empty reply and a reply that is too long, naming the field", async () => {
        const empty = { key: "reply_empty" }
        expect(await run(memoryWorld(), { id: "c2", text: "   " })).toEqual({
            ok: false,
            reason: "invalid",
            message: empty,
            fields: { text: empty },
        })
        expect(await run(memoryWorld(), { id: "c2", text: "a".repeat(4001) })).toMatchObject({
            reason: "invalid",
            message: { key: "reply_too_long" },
        })
    })

    it("refuses a caller who is no member of the workspace, and an agent run", async () => {
        const forbidden = { ok: false, reason: "forbidden", message: { key: "reply_forbidden" } }
        expect(await run(memoryWorld(), { id: "c2", text: "Hi" }, "stranger")).toEqual(forbidden)
        expect(await run(memoryWorld(), { id: "c2", text: "Hi" }, null)).toEqual(forbidden)
    })

    it("changes nothing when the conversation moved meanwhile", async () => {
        const world = memoryWorld()
        const stale = overriding(world, CONVERSATIONS.id, {
            ...conversationApi(world),
            get: () => Promise.resolve(recordOfThread({ ...HANDLED_ROW, version: "0" })),
        })
        const result = await REPLY.execute?.(stale, { id: "c2", text: "Hello" }, STAFF_CONTEXT)
        expect(result).toEqual({ ok: false, reason: "conflict", message: { key: "handling_conflict" } })
        expect(world.lines).toEqual([])
        expect(world.jobs).toEqual([])
    })

    it("answers not found when the conversation is gone between the read and the write", async () => {
        const world = memoryWorld()
        const gone = overriding(world, CONVERSATIONS.id, {
            ...conversationApi(world),
            update: () => Promise.resolve({ ok: false, reason: "missing" }),
        })
        expect(await REPLY.execute?.(gone, { id: "c2", text: "Hello" }, STAFF_CONTEXT)).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "reply_not_found" },
        })
        expect(world.jobs).toEqual([])
    })

    it("refuses the whole action when the line cannot be stored, enqueuing nothing", async () => {
        const world = memoryWorld()
        const refused = overriding(world, MESSAGES.id, {
            ...messageApi(world),
            insert: () => Promise.resolve({ ok: false, reason: "invalid" }),
        })
        expect(await REPLY.execute?.(refused, { id: "c2", text: "Hello" }, STAFF_CONTEXT)).toMatchObject({
            ok: false,
            reason: "conflict",
        })
        expect(world.jobs).toEqual([])
    })

    it("refuses a payload with a field it does not declare, and declares what the screen fetches again", async () => {
        expect(await run(memoryWorld(), { id: "c2", text: "Hi", extra: true })).toMatchObject({
            ok: false,
            reason: "invalid",
        })
        expect(REPLY.refreshes).toContain("chatbot.messages")
        expect(REPLY.transactional).toBe(true)
        expect(REPLY.permission).toBe("chatbot.reply")
    })
})
