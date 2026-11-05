import { CHATBOT_CHANNELS, INBOX_STATUSES } from "../../../rules/chatbot"
import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { THREAD_ROWS } from "../fixtures/chatbot.fixtures"
import { THREADS, THREADS_SHAPE } from "./threads.read"

describe("the chatbot.threads read", () => {
    it("searches the name and the last words, filters by status and channel, and sorts by the last activity", () => {
        expect(THREADS_SHAPE.search).toEqual({ fields: ["name", "lastText"] })
        expect(THREADS_SHAPE.filters).toEqual({
            status: { field: "status", op: "eq", of: INBOX_STATUSES },
            channel: { field: "channel", op: "eq", of: CHATBOT_CHANNELS },
        })
        expect(THREADS_SHAPE.sort).toEqual({ recent: [["lastAt", "desc"]] })
        expect(THREADS_SHAPE.row).toEqual({ id: "id", title: "name", description: "lastText" })
    })

    it("lists the page of the source under the query its variables name", async () => {
        const world = memoryWorld()
        const result = await THREADS.execute?.(
            memoryProvider(world),
            { q: " Minh ", status: "needs", channel: "all" },
            STAFF_CONTEXT,
        )
        expect(result).toEqual({ ok: true, data: { rows: THREAD_ROWS, cursor: null } })
        expect(world.queries).toEqual([
            { q: "Minh", filters: { status: "needs" }, sort: "recent", cursor: null, size: 30 },
        ])
    })

    it("refuses a status the list does not offer", async () => {
        const result = await THREADS.execute?.(memoryProvider(memoryWorld()), { status: "closed" }, STAFF_CONTEXT)
        expect(result).toEqual({ ok: false, problems: [{ code: "INPUT_INVALID", at: "status" }] })
    })

    it("is read with the view permission and exposes its rows at the path rows", () => {
        expect(THREADS.permission).toBe("chatbot.view")
        expect(THREADS.paths).toEqual({ rows: "list" })
        expect(THREADS.dataKind).toBe("conversation")
    })
})
