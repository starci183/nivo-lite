import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import {
    MANAGER_ID,
    STAFF_ID,
    STAFF_CONTEXT,
    conversationApi,
    conversationOf,
    memoryProvider,
    memoryWorld,
    replyApi,
    recordOfThread,
} from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { CONVERSATIONS, REPLIES } from "../ports"
import { CHATBOT_REPLY_ENTITY } from "../../../entities/chat/chatbot-entity-names"
import { REPLY } from "./reply.action"
// Design change (owner ruling R26, MESSAGES-PLAN section 5): the reply writes no chatbot line record; the words wait as the chatbot's
// reply work item (job payloads carry ids only) and the delivery job's door call is the one write of the customer line.

const run = (world: MemoryWorld, input: unknown, memberId: string | null = STAFF_CONTEXT.memberId) =>
    REPLY.execute?.(memoryProvider(world, memberId ?? STAFF_ID), input, { ...STAFF_CONTEXT, memberId })

/** A provider whose port `id` is the given api, every other port the world's. */
const overriding = (world: MemoryWorld, id: string, api: object): PortProvider => {
    const base = memoryProvider(world)
    return { implementationOf: (port) => (port.id === id ? api : base.implementationOf(port)) }
}

describe("the blocks-core.chatbot.chat-reply action", () => {
    it("keeps the words as the reply work item and enqueues its delivery by id, calling no channel and writing no line", async () => {
        const world = memoryWorld()
        const result = await run(world, { id: "c2", text: "  Invoice is on its way.  " })
        expect(result).toEqual({ ok: true, data: { replyId: "r1" } })
        expect(world.replies).toHaveLength(1)
        expect(world.replies[0]?.data).toEqual({
            conversationId: "c2",
            text: "Invoice is on its way.",
            memberId: STAFF_ID,
            key: expect.stringMatching(/^[0-9a-f-]{36}$/),
        })
        expect(world.links).toContainEqual({ entity: CHATBOT_REPLY_ENTITY, id: "r1", relation: "conversation", to: "c2" })
        expect(world.jobs).toEqual([{ job: "chatbot.deliver-reply", input: { replyId: "r1" } }])
        expect(world.sends).toEqual([])
        expect(conversationOf(world, "c2")).toMatchObject({
            version: "8",
            lastAt: "2026-11-05T03:00:00.000Z",
            // R43: the chat stores only its open question's mark; the hold is the route's.
            status: "ai",
            unanswered: false,
        })
    })

    it("makes a new send key for every reply, so two equal replies are both told", async () => {
        const world = memoryWorld()
        await run(world, { id: "c2", text: "Hello" })
        await run(world, { id: "c2", text: "Hello" })
        expect(new Set(world.replies.map((row) => row.data["key"])).size).toBe(2)
    })

    it("refuses the whole action when the reply cannot be kept, enqueuing nothing", async () => {
        const world = memoryWorld()
        const refused = overriding(world, REPLIES.id, {
            ...replyApi(world),
            insert: () => Promise.resolve({ ok: false, reason: "invalid" }),
        })
        expect(await REPLY.execute?.(refused, { id: "c2", text: "Hello" }, STAFF_CONTEXT)).toMatchObject({ ok: false, reason: "conflict" })
        expect(world.jobs).toEqual([])
    })

    it("lets a manager reply in a conversation another person holds", async () => {
        const world = memoryWorld()
        expect(await run(world, { id: "c2", text: "Hello" }, MANAGER_ID)).toMatchObject({ ok: true })
        expect(world.replies[0]?.data).toMatchObject({ memberId: MANAGER_ID })
    })

    it("refuses staff a conversation another person holds", async () => {
        // R43: the holder is the engine's route hold, not a chat field.
        const world = memoryWorld()
        world.holds.set(HANDLED_ROW.routeId ?? "", { memberId: "member-minh", at: "2026-11-04T00:30:00.000Z" })
        expect(await run(world, { id: "c2", text: "Hello" })).toEqual({
            ok: false,
            reason: "forbidden",
            message: { key: "reply_held_by_other" },
        })
        expect(world.jobs).toEqual([])
    })

    // R43: nobody holds the route of c1 (the hold is the engine's); c3 has no route at all, so it cannot be held (reply_not_found).
    it("asks to take the conversation over first when nobody holds it", async () => {
        expect(await run(memoryWorld(), { id: "c3", text: "Hello" })).toMatchObject({ ok: false, message: { key: "reply_not_found" } })
        expect(await run(memoryWorld(), { id: "c1", text: "Hello" })).toEqual({
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

    it("refuses a payload with a field it does not declare, and declares what the screen fetches again", async () => {
        expect(await run(memoryWorld(), { id: "c2", text: "Hi", extra: true })).toMatchObject({
            ok: false,
            reason: "invalid",
        })
        expect(REPLY.refreshes).toContain("blocks-core.chatbot.api.message.list")
        expect(REPLY.transactional).toBe(true)
        expect(REPLY.permission).toBe("chatbot.reply")
    })
})
