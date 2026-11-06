import { WAITING_ROW } from "../fixtures/chatbot.fixtures"
import { STAFF_CONTEXT, memoryProvider, memoryWorld, messageApi, recordOfThread } from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { MESSAGES_PAGE_SIZE, THREAD_MESSAGES } from "./messages.read"

interface Line {
    readonly [field: string]: string | null
}

const lineOf = (n: number, patch: Line): Line => ({
    conversationId: "c2",
    role: "user",
    text: `line ${n}`,
    sentAt: `2026-11-04T00:${String(n % 60).padStart(2, "0")}:00.000Z`,
    authorKind: null,
    authorName: null,
    authorUserId: null,
    ...patch,
})

const stored = async (world: MemoryWorld, lines: ReadonlyArray<Line>): Promise<void> => {
    const api = messageApi(world)
    for (const line of lines) await api.insert(line, { conversation: String(line["conversationId"]) })
}

describe("the chatbot.messages read", () => {
    it("draws the lines of a thread for the conversation block, under the customer name", async () => {
        const world = memoryWorld()
        await stored(world, [
            lineOf(1, {}),
            lineOf(2, { role: "agent", authorKind: "ai" }),
            lineOf(3, { role: "system", text: "Ha took over" }),
        ])
        const result = await THREAD_MESSAGES.execute?.(memoryProvider(world), { threadId: "c2" }, STAFF_CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { cursor: null } })
        expect(result).toMatchObject({
            data: {
                rows: [
                    { text: "Ha took over", side: "notice", who: "" },
                    { text: "line 2", side: "outgoing", who: "AI", mark: "AI" },
                    { text: "line 1", side: "incoming", who: "Bao Tran Le" },
                ],
            },
        })
    })

    it("pages to older lines with the cursor the engine signed", async () => {
        const world = memoryWorld()
        await stored(
            world,
            Array.from({ length: MESSAGES_PAGE_SIZE + 1 }, (_, index) => lineOf(index, {})),
        )
        const first = await THREAD_MESSAGES.execute?.(memoryProvider(world), { threadId: "c2" }, STAFF_CONTEXT)
        expect(first).toMatchObject({ ok: true, data: { cursor: String(MESSAGES_PAGE_SIZE) } })
        const next = await THREAD_MESSAGES.execute?.(
            memoryProvider(world),
            { threadId: "c2", cursor: String(MESSAGES_PAGE_SIZE) },
            STAFF_CONTEXT,
        )
        expect(next).toMatchObject({ ok: true, data: { rows: [{ text: "line 0" }], cursor: null } })
    })

    it("leaves out the lines of other conversations and the records that are not lines", async () => {
        const world = memoryWorld()
        await stored(world, [lineOf(1, {}), lineOf(2, { conversationId: "c1" })])
        world.lines.push({ ...recordOfThread(WAITING_ROW), id: "bad", data: { conversationId: "c2", role: 7 } })
        const result = await THREAD_MESSAGES.execute?.(memoryProvider(world), { threadId: "c2" }, STAFF_CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { rows: [{ text: "line 1" }], cursor: null } })
    })

    it("answers an empty page for a conversation the workspace does not have", async () => {
        const result = await THREAD_MESSAGES.execute?.(
            memoryProvider(memoryWorld()),
            { threadId: "nope" },
            STAFF_CONTEXT,
        )
        expect(result).toEqual({ ok: true, data: { rows: [], cursor: null } })
    })

    it("exposes its rows at the path rows and refuses a missing thread id", async () => {
        expect(THREAD_MESSAGES.paths).toEqual({ rows: "list" })
        const result = await THREAD_MESSAGES.execute?.(memoryProvider(memoryWorld()), {}, STAFF_CONTEXT)
        expect(result).toEqual({ ok: false, problems: [{ code: "INPUT_INVALID", at: "threadId" }] })
    })
})
