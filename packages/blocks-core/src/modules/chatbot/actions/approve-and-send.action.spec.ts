import type { MessageRecord } from "../chatbot.types"
import { MANAGER_ID, STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import { APPROVE_AND_SEND } from "./approve-and-send.action"
import { REJECT_PROPOSAL } from "./reject-proposal.action"

const PROPOSED: MessageRecord = {
    id: "p1",
    version: "1",
    conversationId: "c2",
    role: "agent",
    text: "Yes, covered for a year.",
    sentAt: "2026-11-05T02:00:00.000Z",
    authorKind: "ai",
    authorName: null,
    authorUserId: null,
    status: "proposed",
    deliveryStatus: null,
    deliveryError: null,
}

const worldWith = (line: MessageRecord = PROPOSED): MemoryWorld => {
    const world = memoryWorld()
    world.lines.push(line)
    return world
}

const approve = (world: MemoryWorld, input: unknown, memberId: string | null = MANAGER_ID) =>
    APPROVE_AND_SEND.execute?.(memoryProvider(world), input, { ...STAFF_CONTEXT, memberId })

describe("the chatbot.approve-and-send action", () => {
    it("posts the proposed reply, moves the conversation and enqueues the delivery, calling no channel", async () => {
        const world = worldWith()
        expect(await approve(world, { id: "p1" })).toEqual({ ok: true, data: { messageId: "p1" } })
        expect(world.lines[0]).toMatchObject({ status: "posted", text: "Yes, covered for a year.", version: "2" })
        expect(world.conversations.get("c2")).toMatchObject({
            lastText: "Yes, covered for a year.",
            lastAt: "2026-11-05T03:00:00.000Z",
        })
        expect(world.jobs).toEqual([{ messageId: "p1" }])
        expect(world.sends).toEqual([])
    })

    it("posts the words the person changed them to", async () => {
        const world = worldWith()
        await approve(world, { id: "p1", text: "  Yes, two years.  " })
        expect(world.lines[0]).toMatchObject({ status: "posted", text: "Yes, two years." })
    })

    it("refuses a line that is not proposed or does not exist", async () => {
        const closed = { ok: false, reason: "refused", message: { key: "proposal_closed" } }
        expect(await approve(worldWith({ ...PROPOSED, status: "posted" }), { id: "p1" })).toEqual(closed)
        expect(await approve(worldWith(), { id: "nope" })).toEqual(closed)
    })

    it("refuses empty words, a stranger, a conversation that is gone and one another person holds", async () => {
        expect(await approve(worldWith(), { id: "p1", text: "  " })).toMatchObject({
            reason: "invalid",
            fields: { text: { key: "reply_empty" } },
        })
        expect(await approve(worldWith(), { id: "p1" }, "stranger")).toMatchObject({
            reason: "forbidden",
            message: { key: "reply_forbidden" },
        })
        expect(await approve(worldWith(), { id: "p1" }, null)).toMatchObject({ reason: "forbidden" })
        expect(await approve(worldWith({ ...PROPOSED, conversationId: "gone" }), { id: "p1" })).toMatchObject({
            message: { key: "reply_not_found" },
        })
        const held = worldWith()
        held.conversations.set("c2", { ...HANDLED_ROW, handledBy: "Minh" })
        expect(await approve(held, { id: "p1" }, STAFF_CONTEXT.memberId)).toMatchObject({
            reason: "forbidden",
            message: { key: "reply_held_by_other" },
        })
    })

    it.each(["chatbot.conversations", "chatbot.messages-store"])("refuses when %s changed under it", async (portId) => {
        const store = memoryProvider(worldWith())
        const stale = {
            implementationOf: (port: Parameters<typeof store.implementationOf>[0]) => {
                const implementation = store.implementationOf(port)
                if (port.id !== portId || typeof implementation !== "object" || implementation === null)
                    return implementation
                return { ...implementation, update: () => Promise.resolve({ ok: false, reason: "conflict" }) }
            },
        }
        expect(
            await APPROVE_AND_SEND.execute?.(stale, { id: "p1" }, { ...STAFF_CONTEXT, memberId: MANAGER_ID }),
        ).toMatchObject({ reason: "conflict" })
    })

    it("is transactional and refreshes the proposal and the thread", () => {
        expect(APPROVE_AND_SEND).toMatchObject({ permission: "chatbot.reply", transactional: true })
        expect(APPROVE_AND_SEND.refreshes).toContain("chatbot.proposals")
    })
})

describe("the chatbot.reject-proposal action", () => {
    it("keeps the line as rejected and sends nothing", async () => {
        const world = worldWith()
        expect(await REJECT_PROPOSAL.execute?.(memoryProvider(world), { id: "p1" }, STAFF_CONTEXT)).toEqual({
            ok: true,
        })
        expect(world.lines[0]).toMatchObject({ status: "rejected" })
        expect(world.jobs).toEqual([])
    })

    it("refuses a line that is not proposed or does not exist", async () => {
        const closed = { ok: false, reason: "refused", message: { key: "proposal_closed" } }
        expect(
            await REJECT_PROPOSAL.execute?.(
                memoryProvider(worldWith({ ...PROPOSED, status: "rejected" })),
                { id: "p1" },
                STAFF_CONTEXT,
            ),
        ).toEqual(closed)
        expect(await REJECT_PROPOSAL.execute?.(memoryProvider(worldWith()), { id: "nope" }, STAFF_CONTEXT)).toEqual(
            closed,
        )
    })
})
