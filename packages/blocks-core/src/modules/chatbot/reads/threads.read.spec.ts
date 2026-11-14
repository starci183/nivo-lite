import type { CustomerLine } from "@nivo-lite/agent-sdk/platform"
import { customerMessagesPort } from "@nivo-lite/agent-sdk/platform"
import { CHAT_MARKS, CHATBOT_CHANNELS } from "../../../rules/chatbot"
import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { HANDLED_ROW, THREAD_ROWS, WAITING_ROW } from "../fixtures/chatbot.fixtures"
import { THREADS, THREADS_SHAPE } from "./threads.read"

// Design change (owner ruling R26, MESSAGES-PLAN section 5): the chat stores no preview (`lastText`, `lastRole`, `messageCount` gone);
// the list joins the last line said on each chat's route, within the chat's window, from the ENGINE's conversation. Search is by name.

/** One engine line on a route. */
const lineOf = (routeId: string, saidAt: string, patch: Partial<CustomerLine> = {}): CustomerLine => ({
    id: `${routeId}:${saidAt}`,
    routeId,
    contactId: "contact",
    direction: "from_person",
    saidAt,
    text: "hello",
    files: [],
    order: null,
    agentId: null,
    memberId: null,
    state: null,
    reason: null,
    channel: "zalo",
    accountId: null,
    deliveredAt: null,
    ...patch,
})

const WAITING_ROUTE = WAITING_ROW.routeId ?? ""
const HANDLED_ROUTE = HANDLED_ROW.routeId ?? ""

describe("the blocks-core.chatbot.api.chat.list read", () => {
    it("searches the name, filters by status and channel, and sorts by the last activity", () => {
        expect(THREADS_SHAPE.search).toEqual({ fields: ["name"] })
        expect(THREADS_SHAPE.filters).toEqual({
            // R43: the status filter narrows on the stored mark (needs / ai); a held route is shown, never filtered.
            status: { field: "status", op: "eq", of: CHAT_MARKS },
            channel: { field: "channel", op: "eq", of: CHATBOT_CHANNELS },
            moved: { field: "lastAt", op: "within", of: ["$today"] },
        })
        expect(THREADS_SHAPE.sort).toEqual({ recent: [["lastAt", "desc"]] })
        expect(THREADS_SHAPE.row).toEqual({ id: "id", title: "name" })
    })

    it("lists the page of the source under the query its variables name, each row with the last line said on its route", async () => {
        const world = memoryWorld()
        world.said.push(
            lineOf(WAITING_ROUTE, "2026-11-04T01:09:00.000Z", { text: "Does this pot come with a root warranty?" }),
            lineOf(WAITING_ROUTE, "2026-11-04T01:05:00.000Z", { text: "Hi" }),
            lineOf(HANDLED_ROUTE, "2026-11-04T00:45:00.000Z", { direction: "to_person", memberId: "m", state: "delivered", text: "Invoice today." }),
        )
        const result = await THREADS.execute?.(
            memoryProvider(world),
            { q: " Minh ", status: "needs", channel: "all" },
            STAFF_CONTEXT,
        )
        const last = {
            c1: { lastText: "Does this pot come with a root warranty?", lastRole: "user" },
            c2: { lastText: "Invoice today.", lastRole: "agent" },
        }
        // R43: each row also carries who holds its route (the engine's hold, named from the members) and the status shown from it.
        const rows = THREAD_ROWS.map((row) => ({
            ...row,
            ...(row.id === "c1" || row.id === "c2" ? last[row.id] : { lastText: "", lastRole: null }),
            ...(row.id === "c2" ? { status: "handled", handledBy: "Thu Ha Le" } : { handledBy: "" }),
        }))
        expect(result).toEqual({ ok: true, data: { rows, cursor: null } })
        expect(world.queries).toEqual([
            { q: "Minh", filters: { status: "needs" }, sort: "recent", cursor: null, size: 30 },
        ])
    })

    it("narrows to the conversations that moved today, the window resolved from the clock of the run", async () => {
        const world = memoryWorld()
        await THREADS.execute?.(memoryProvider(world), { moved: "$today" }, STAFF_CONTEXT)
        expect(world.queries).toEqual([
            {
                q: null,
                filters: {},
                windows: { moved: { from: "2026-11-05T00:00:00.000Z", to: "2026-11-06T00:00:00.000Z" } },
                sort: "recent",
                cursor: null,
                size: 30,
            },
        ])
    })

    it("takes the last line said: a refused or unknown send was never told, and a line before the chat's window belongs to an earlier visit", async () => {
        const world = memoryWorld()
        world.said.push(
            lineOf(HANDLED_ROUTE, "2026-11-04T00:50:00.000Z", { direction: "to_person", state: "refused", text: "not told" }),
            lineOf(HANDLED_ROUTE, "2026-11-04T00:49:00.000Z", { direction: "to_person", state: "unknown", text: "not known" }),
            lineOf(HANDLED_ROUTE, "2026-11-04T00:40:00.000Z", { text: "said" }),
            lineOf(WAITING_ROUTE, "2026-11-04T00:59:00.000Z", { text: "before the visit" }),
        )
        const result = await THREADS.execute?.(memoryProvider(world), {}, STAFF_CONTEXT)
        expect(result).toMatchObject({
            ok: true,
            data: { rows: [{ id: "c1", lastText: "", lastRole: null }, { id: "c2", lastText: "said", lastRole: "user" }, {}, {}] },
        })
    })

    it("reads the engine's conversation through its port and selects the route and window of each chat", () => {
        expect(THREADS.ports).toMatchObject({ lines: customerMessagesPort })
        expect(THREADS.fields).toEqual(expect.arrayContaining(["routeId", "startedAt", "lastText", "lastRole"]))
        expect(THREADS.fields).not.toContain("messageCount")
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
