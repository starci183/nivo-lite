import type { CustomerLine } from "@nivo-lite/agent-sdk/platform"
import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import { STAFF_CONTEXT, STAFF_ID, memoryProvider, memoryWorld, noteApi, putConversation } from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { MESSAGES_PAGE_SIZE, THREAD_MESSAGES } from "./messages.read"

// Design change (owner ruling R26, MESSAGES-PLAN section 5): the chatbot keeps no line; the thread is the ENGINE's lines of the chat's route
// (`platform.customer-messages`, both directions, every agent's and the members' typed replies) from the chat's `startedAt`, with the
// chatbot's own notes (a person took the thread over or gave it back) beside them. The old cases over chatbot message records and the
// delivery-ledger merge are gone with them.

/** One engine line of the conversation `c2` (route `route-2`), minute `n` after 00:30. */
const lineOf = (n: number, patch: Partial<CustomerLine> = {}): CustomerLine => ({
    id: `l${n}`,
    routeId: "route-2",
    contactId: "0c0a0000-0000-4000-8000-0000000000c2",
    direction: "from_person",
    saidAt: `2026-11-04T00:${String(30 + (n % 30)).padStart(2, "0")}:00.000Z`,
    text: `line ${n}`,
    files: [],
    order: null,
    agentId: null,
    memberId: null,
    state: null,
    reason: null,
    channel: "telegram",
    accountId: null,
    deliveredAt: null,
    ...patch,
})

const read = (world: MemoryWorld, variables: Readonly<Record<string, string>>) =>
    THREAD_MESSAGES.execute?.(memoryProvider(world), variables, STAFF_CONTEXT)

describe("the blocks-core.chatbot.api.message.list read", () => {
    it("draws the route's lines, both directions, newest first: the customer by name, an agent's line as AI, a member's reply by the member", async () => {
        const world = memoryWorld()
        world.said.push(
            lineOf(1),
            lineOf(2, { direction: "to_person", agentId: "agent-sales", state: "delivered" }),
            lineOf(3, { direction: "to_person", memberId: STAFF_ID, state: "delivered" }),
        )
        const result = await read(world, { threadId: "c2" })
        expect(result).toMatchObject({
            ok: true,
            data: {
                cursor: null,
                rows: [
                    { id: "l3", text: "line 3", side: "outgoing", who: "Thu Ha Le", state: "sent" },
                    { id: "l2", text: "line 2", side: "outgoing", who: "AI", mark: "AI", state: "sent", sentBy: "agent-sales" },
                    { id: "l1", text: "line 1", side: "incoming", who: "Bao Tran Le" },
                ],
            },
        })
    })

    it("shows a send that did not arrive as failed and leaves out one still claimed", async () => {
        const world = memoryWorld()
        world.said.push(
            lineOf(1, { direction: "to_person", agentId: "agent-sales", state: "refused", reason: "window_closed" }),
            lineOf(2, { direction: "to_person", agentId: "agent-sales", state: "claimed" }),
        )
        const result = await read(world, { threadId: "c2" })
        expect(result).toMatchObject({ ok: true, data: { rows: [{ id: "l2", state: "" }, { id: "l1", state: "failed" }] } })
    })

    it("shows the chatbot's notes beside the lines, as notice lines", async () => {
        const world = memoryWorld()
        world.said.push(lineOf(1), lineOf(3))
        await noteApi(world).insert(
            { conversationId: "c2", kind: "taken", text: "Ha took over", at: "2026-11-04T00:32:00.000Z", memberId: STAFF_ID },
            { conversation: "c2" },
        )
        const result = await read(world, { threadId: "c2" })
        expect(result).toMatchObject({
            ok: true,
            data: { rows: [{ text: "line 3" }, { text: "Ha took over", side: "notice", who: "" }, { text: "line 1" }] },
        })
    })

    it("reads only from the chat's startedAt (a Telegram /start opened it) and only the chat's route", async () => {
        const world = memoryWorld()
        world.said.push(
            lineOf(0, { saidAt: "2026-11-04T00:10:00.000Z", text: "before the visit" }),
            lineOf(1),
            lineOf(2, { routeId: "route-other", text: "another route" }),
        )
        const result = await read(world, { threadId: "c2" })
        expect(result).toMatchObject({ ok: true, data: { rows: [{ text: "line 1" }] } })
        expect(result).toMatchObject({ data: { rows: { length: 1 } } })
    })

    it("pages to older lines with the engine's cursor", async () => {
        const world = memoryWorld()
        world.said.push(...Array.from({ length: MESSAGES_PAGE_SIZE + 1 }, (_, index) => lineOf(index, { id: `l${String(index).padStart(3, "0")}`, saidAt: new Date(Date.parse("2026-11-04T01:00:00.000Z") + index * 1000).toISOString() })))
        const first = await read(world, { threadId: "c2" })
        expect(first).toMatchObject({ ok: true, data: { rows: { length: MESSAGES_PAGE_SIZE } } })
        const cursor = first?.ok === true ? (first.data as { cursor: string | null }).cursor : null
        expect(cursor).not.toBeNull()
        const next = await read(world, { threadId: "c2", cursor: cursor ?? "" })
        expect(next).toMatchObject({ ok: true, data: { rows: [{ id: "l000" }], cursor: null } })
    })

    it("answers an empty page for a conversation the workspace does not have, and for a chat with no route yet", async () => {
        const world = memoryWorld()
        world.said.push(lineOf(1))
        expect(await read(world, { threadId: "missing" })).toEqual({ ok: true, data: { rows: [], cursor: null } })
        putConversation(world, { ...HANDLED_ROW, routeId: null })
        expect(await read(world, { threadId: "c2" })).toEqual({ ok: true, data: { rows: [], cursor: null } })
    })

    it("exposes its rows at the path rows and refuses a missing thread id", async () => {
        expect(THREAD_MESSAGES.paths).toEqual({ rows: "list" })
        const result = await read(memoryWorld(), {})
        expect(result).toEqual({ ok: false, problems: [{ code: "INPUT_INVALID", at: "threadId" }] })
    })
})
