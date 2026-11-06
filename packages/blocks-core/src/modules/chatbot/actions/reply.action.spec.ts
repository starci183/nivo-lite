import { MANAGER_ID, STAFF_CONTEXT, conversationStore, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import { CONVERSATIONS } from "../ports"
import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { REPLY } from "./reply.action"

const run = (world: ReturnType<typeof memoryWorld>, input: unknown, memberId: string | null = STAFF_CONTEXT.memberId) =>
    REPLY.execute?.(memoryProvider(world), input, { ...STAFF_CONTEXT, memberId })

describe("the chatbot.reply action", () => {
    it("stores the reply of the person who holds the conversation and enqueues its delivery, calling no channel", async () => {
        const world = memoryWorld()
        const result = await run(world, { id: "c2", text: "  Invoice is on its way.  " })
        expect(result).toEqual({ ok: true, data: { messageId: "m1" } })
        expect(world.lines).toEqual([
            {
                id: "m1",
                version: "1",
                conversationId: "c2",
                role: "agent",
                text: "Invoice is on its way.",
                sentAt: "2026-11-05T03:00:00.000Z",
                authorKind: "human",
                authorName: "L\u00ea Thu H\u00e0",
                authorUserId: "member-staff",
                status: "posted",
                deliveryStatus: null,
                deliveryError: null,
            },
        ])
        expect(world.jobs).toEqual([{ messageId: "m1" }])
        expect(world.sends).toEqual([])
        expect(world.conversations.get("c2")).toMatchObject({
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
        expect(world.lines[0]).toMatchObject({ authorName: "Lan Pham" })
    })

    it("refuses staff a conversation another person holds", async () => {
        const world = memoryWorld()
        world.conversations.set("c2", { ...HANDLED_ROW, handledBy: "Minh" })
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
        const base = memoryProvider(world)
        const stale: PortProvider = {
            implementationOf: (port) =>
                port.id === CONVERSATIONS.id
                    ? { ...conversationStore(world), get: () => Promise.resolve({ ...HANDLED_ROW, version: "0" }) }
                    : base.implementationOf(port),
        }
        const result = await REPLY.execute?.(stale, { id: "c2", text: "Hello" }, STAFF_CONTEXT)
        expect(result).toEqual({
            ok: false,
            reason: "conflict",
            message: { key: "handling_conflict" },
        })
        expect(world.lines).toEqual([])
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
