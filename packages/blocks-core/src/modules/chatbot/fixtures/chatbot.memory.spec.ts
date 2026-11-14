import { doorPort, outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { definePort, portsOf } from "@nivo-lite/agent-sdk/port"
import { membersPort } from "../../platform/ports"
import { DELIVER_REPLY } from "../jobs/deliver-reply.job"
import { CONVERSATIONS, NOTES, SETTINGS, THREADS_LIST } from "../ports"
import { THREADS_SHAPE } from "../reads/threads.read"
import { HANDLED_ROW } from "./chatbot.fixtures"
import {
    conversationApi,
    conversationOf,
    memoryProvider,
    memoryWorld,
    noteApi,
    putConversation,
    recordOfThread,
    settingsApi,
    threadsList,
} from "./chatbot.memory"
import { CHATBOT_NOTE_ENTITY } from "../../../entities/chat/chatbot-entity-names"

const QUERY = { q: null, filters: {}, sort: "recent", cursor: null, size: 2 }

// Design change (owner ruling R26): the chatbot keeps no line record; the record it writes beside a chat is its own note.
const NOTE = {
    conversationId: "c1",
    kind: "taken",
    text: "Ha took over",
    at: "2026-11-05T00:00:00.000Z",
    memberId: "member-staff",
}

const RECENT = [
    ["lastAt", "desc"],
    ["id", "desc"],
] as const

describe("the fake engine", () => {
    it("update a conversation by its version, and refuse a missing one or a stale version", async () => {
        const world = memoryWorld()
        const api = conversationApi(world)
        expect(await api.update("c3", "2", { name: "Ha" })).toMatchObject({ ok: true, row: { version: "3" } })
        expect(await api.update("c3", "2", { name: "Lan" })).toEqual({ ok: false, reason: "stale" })
        expect(await api.update("nope", "1", {})).toEqual({ ok: false, reason: "missing" })
        expect(await api.get("nope")).toBeNull()
        expect(conversationOf(world, "c3")).toMatchObject({ name: "Ha", version: "3" })
    })

    it("store a note with its links and update it by its version", async () => {
        const world = memoryWorld()
        const api = noteApi(world)
        const stored = await api.insert(NOTE, { conversation: "c1" })
        expect(stored).toMatchObject({ ok: true, version: "1", created: true, row: { id: "n1" } })
        expect(world.links).toContainEqual({
            entity: CHATBOT_NOTE_ENTITY,
            id: "n1",
            relation: "conversation",
            to: "c1",
        })
        const patch = { text: "Ha took over the conversation" }
        expect(await api.update("n1", "1", patch)).toMatchObject({ ok: true, row: { version: "2" } })
        expect(await api.update("n1", "1", patch)).toEqual({ ok: false, reason: "stale" })
        expect(await api.update("nope", "1", patch)).toEqual({ ok: false, reason: "missing" })
        expect(await api.get("nope")).toBeNull()
        expect((await api.insert(NOTE)).ok).toBe(true)
        expect(world.links).toHaveLength(1)
    })

    it("list a page of a query the planner accepts: selected fields, order and cursor", async () => {
        const api = conversationApi(memoryWorld())
        const zalo = await api.list({
            select: ["name", "lastAt"],
            where: { op: "eq", field: "channel", value: "zalo" },
            order: [["channel", "asc"], ...RECENT],
            page: { size: 5 },
        })
        expect(zalo.rows.map((row) => row.row.id)).toEqual(["c1"])
        expect(zalo.rows[0]?.row.data).toEqual({ name: "Minh Anh Nguyen", lastAt: "2026-11-04T01:09:00.000Z" })
        const first = await api.list({
            select: ["name"],
            order: RECENT,
            page: { size: 2 },
        })
        expect(first.rows.map((row) => row.row.id)).toEqual(["c1", "c2"])
        expect(first.next).toBe("2")
        const rest = await api.list({ select: ["name"], order: RECENT, page: { size: 5, after: "2" } })
        expect(rest.rows.map((row) => row.row.id)).toEqual(["c3", "c4"])
    })

    it("match an equality, both of two, and nothing else", async () => {
        const api = conversationApi(memoryWorld())
        const both = await api.list({
            select: ["name"],
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "status", value: "ai" },
                    { op: "eq", field: "channel", value: "website" },
                ],
            },
            order: [["status", "asc"], ["channel", "asc"], ...RECENT],
            page: { size: 5 },
        })
        expect(both.rows.map((row) => row.row.id)).toEqual(["c3"])
        const one = await api.list({
            select: ["name"],
            where: { op: "eq", field: "status", value: "ai" },
            order: [["status", "asc"], ...RECENT],
            page: { size: 5 },
        })
        // R43: the held chat c2 stores the mark `ai` too (its hold is the engine's route).
        expect(one.rows.map((row) => row.row.id)).toEqual(["c2", "c3", "c4"])
        const other = await api.list({
            select: ["name"],
            where: { op: "notNull", field: "lastAt" },
            order: RECENT,
            page: { size: 5 },
        })
        expect(other.rows).toEqual([])
    })

    it("refuse a query the planner would refuse, an unindexed one", async () => {
        const api = conversationApi(memoryWorld())
        await expect(
            api.list({
                select: ["name"],
                order: [
                    ["name", "asc"],
                    ["id", "asc"],
                ],
                page: { size: 5 },
            }),
        ).rejects.toThrow("QUERY_NOT_INDEXED")
    })

    it("does not run the calls the module never makes", async () => {
        const api = conversationApi(memoryWorld())
        await expect(api.aggregate({ measures: {}, limit: 1 })).rejects.toThrow("does not run")
        await expect(api.ensure("key", {})).rejects.toThrow("does not run")
        await expect(api.delete("c1")).rejects.toThrow("does not run")
        await expect(api.link("c1", "messages", "m1")).rejects.toThrow("does not run")
        await expect(api.unlink("c1", "messages", "m1")).rejects.toThrow("does not run")
    })

    it("upsert a settings record by its unique key: add the first, set the fields of the one that holds the key", async () => {
        const world = memoryWorld()
        const api = settingsApi(world)
        const first = await api.upsert("scope_key", { scope: "chatbot", holdingMessage: "a" })
        const second = await api.upsert("scope_key", { scope: "chatbot", holdingMessage: "b" })
        expect(first).toMatchObject({ ok: true, created: true })
        expect(second).toMatchObject({ ok: true, version: "2" })
        expect(world.settings).toHaveLength(1)
        expect(world.settings[0]?.data).toMatchObject({ holdingMessage: "b" })
    })

    it("treats a key that names no unique constraint as holding no record, so the upsert stores a new one", async () => {
        const world = memoryWorld()
        const api = settingsApi(world)
        await api.upsert("scope_key", { scope: "chatbot", holdingMessage: "a" })
        await api.upsert("no_such_key", { scope: "other", holdingMessage: "b" })
        expect(world.settings).toHaveLength(2)
    })

    it("count and page the conversations inside the windows of a query only", async () => {
        const source = threadsList(memoryWorld())
        const query = {
            q: null,
            filters: {},
            windows: { moved: { from: "2026-11-04T00:00:00.000Z", to: "2026-11-05T00:00:00.000Z" } },
            sort: "recent",
            cursor: null,
            size: 10,
        }
        // R43: a held chat is counted by its stored mark (`ai`); `handled` is no stored mark.
        expect(await source.counts(THREADS_SHAPE, "status", query)).toEqual({
            needs: 1,
            ai: 1,
        })
        const page = await source.page(THREADS_SHAPE, query)
        expect(page.rows.map((row) => row.id)).toEqual(["c1", "c2"])
    })

    it("hold a conversation row of the world and replace or add one", () => {
        const world = memoryWorld()
        expect(conversationOf(world, "c2")).toEqual(HANDLED_ROW)
        putConversation(world, { ...HANDLED_ROW, name: "Renamed" })
        putConversation(world, { ...HANDLED_ROW, id: "c9" })
        expect(conversationOf(world, "c2")).toMatchObject({ name: "Renamed" })
        expect(conversationOf(world, "c9")).not.toBeNull()
        expect(conversationOf(world, "nope")).toBeNull()
        expect(world.conversations).toHaveLength(5)
        expect(recordOfThread(HANDLED_ROW)).toMatchObject({ id: "c2", version: "7", data: { name: "Bao Tran Le" } })
    })

    it("page the conversations of the inbox by cursor and count them per status or channel", async () => {
        const world = memoryWorld()
        const source = threadsList(world)
        const first = await source.page(THREADS_SHAPE, QUERY)
        expect(first.rows.map((row) => row.id)).toEqual(["c1", "c2"])
        expect(first.cursor).toBe("2")
        const second = await source.page(THREADS_SHAPE, { ...QUERY, cursor: "2" })
        expect(second).toMatchObject({ cursor: null })
        expect(await source.counts(THREADS_SHAPE, "channel", QUERY)).toEqual({
            zalo: 1,
            telegram: 1,
            website: 1,
            facebook: 1,
        })
        expect(await source.counts(THREADS_SHAPE, "status", QUERY)).toEqual({ needs: 1, ai: 3 })
        world.conversations.push({ ...recordOfThread(HANDLED_ROW), id: "bad", data: { name: 1 } })
        expect((await source.page(THREADS_SHAPE, { ...QUERY, size: 9 })).rows).toHaveLength(4)
    })

    it("record the jobs and the sends, and answer for the door what the world says", async () => {
        const world = memoryWorld()
        const { outbox, door } = portsOf(memoryProvider(world), { outbox: outboxPort, door: doorPort })
        const reply = { replyId: "r1" }
        await outbox.enqueue(DELIVER_REPLY, reply)
        expect(world.jobs).toEqual([{ job: "chatbot.deliver-reply", input: reply }])
        expect(await door.call("nivo.tool.customer.message.send", { text: "Hi" }, { onceBy: "k", routeId: "r1" })).toEqual({
            ok: true,
            output: null,
        })
        expect(world.sends).toEqual([
            { tool: "nivo.tool.customer.message.send", input: { text: "Hi" }, options: { onceBy: "k", routeId: "r1" } },
        ])
    })

    it("answer for the members and nobody else, and provide the entity ports", async () => {
        const provider = memoryProvider(memoryWorld())
        const { members } = portsOf(provider, { members: membersPort })
        expect(await members.get("nobody")).toBeNull()
        expect(await members.get("member-manager")).toEqual({ displayName: "Lan Pham", isManager: true })
        for (const port of [THREADS_LIST, CONVERSATIONS, NOTES, SETTINGS])
            expect(provider.implementationOf(port)).toBeDefined()
    })

    it("refuse a port outside the module", () => {
        expect(() => memoryProvider(memoryWorld()).implementationOf(definePort<string>("other.port"))).toThrow()
    })
})
