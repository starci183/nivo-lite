import { doorPort, outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { definePort, portsOf } from "@nivo-lite/agent-sdk/port"
import { membersPort } from "../../platform/ports"
import { DELIVER_REPLY } from "../jobs/deliver-reply.job"
import { CONVERSATIONS, MESSAGES, THREADS_LIST } from "../ports"
import { THREADS_SHAPE } from "../reads/threads.read"
import { HANDLED_ROW } from "./chatbot.fixtures"
import {
    conversationApi,
    conversationOf,
    memoryProvider,
    memoryWorld,
    messageApi,
    putConversation,
    recordOfThread,
    threadsList,
} from "./chatbot.memory"

const QUERY = { q: null, filters: {}, sort: "recent", cursor: null, size: 2 }

const LINE = {
    conversationId: "c1",
    role: "user",
    text: "Hi",
    sentAt: "2026-11-05T00:00:00.000Z",
}

const RECENT = [
    ["lastAt", "desc"],
    ["id", "desc"],
] as const

describe("the fake engine", () => {
    it("update a conversation by its version, and refuse a missing one or a stale version", async () => {
        const world = memoryWorld()
        const api = conversationApi(world)
        expect(await api.update("c3", "2", { handledBy: "Ha" })).toMatchObject({ ok: true, row: { version: "3" } })
        expect(await api.update("c3", "2", { handledBy: "Lan" })).toEqual({ ok: false, reason: "stale" })
        expect(await api.update("nope", "1", {})).toEqual({ ok: false, reason: "missing" })
        expect(await api.get("nope")).toBeNull()
        expect(conversationOf(world, "c3")).toMatchObject({ handledBy: "Ha", version: "3" })
    })

    it("store a line with its links and update it by its version", async () => {
        const world = memoryWorld()
        const api = messageApi(world)
        const stored = await api.insert(LINE, { conversation: "c1" })
        expect(stored).toMatchObject({ ok: true, version: "1", created: true, row: { id: "m1" } })
        expect(world.links).toContainEqual({ entity: "chat.message", id: "m1", relation: "conversation", to: "c1" })
        const patch = { deliveryStatus: "sent", deliveryError: null }
        expect(await api.update("m1", "1", patch)).toMatchObject({ ok: true, row: { version: "2" } })
        expect(await api.update("m1", "1", patch)).toEqual({ ok: false, reason: "stale" })
        expect(await api.update("nope", "1", patch)).toEqual({ ok: false, reason: "missing" })
        expect(await api.get("nope")).toBeNull()
        expect((await api.insert(LINE)).ok).toBe(true)
        expect(world.links).toHaveLength(2)
    })

    it("list a page of a query the planner accepts: selected fields, order, cursor and the joined customer", async () => {
        const api = conversationApi(memoryWorld())
        const zalo = await api.list({
            select: ["name", "lastAt"],
            join: { lead: ["contactName"] },
            where: { op: "eq", field: "channel", value: "zalo" },
            order: [["channel", "asc"], ...RECENT],
            page: { size: 5 },
        })
        expect(zalo.rows.map((row) => row.row.id)).toEqual(["c1"])
        expect(zalo.rows[0]?.row.data).toEqual({ name: "Minh Anh Nguyen", lastAt: "2026-11-04T01:09:00.000Z" })
        expect(zalo.rows[0]?.joined).toEqual({ lead: { id: "l1", data: { contactName: "Minh Anh Nguyen" } } })
        const first = await api.list({
            select: ["name"],
            join: { lead: ["contactName"] },
            order: RECENT,
            page: { size: 2 },
        })
        expect(first.rows.map((row) => row.row.id)).toEqual(["c1", "c2"])
        expect(first.rows[1]?.joined).toEqual({ lead: null })
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
        expect(one.rows.map((row) => row.row.id)).toEqual(["c3", "c4"])
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
        await expect(api.upsert("key", {})).rejects.toThrow("does not run")
        await expect(api.ensure("key", {})).rejects.toThrow("does not run")
        await expect(api.delete("c1")).rejects.toThrow("does not run")
        await expect(api.link("c1", "lead", "l1")).rejects.toThrow("does not run")
        await expect(api.unlink("c1", "lead", "l1")).rejects.toThrow("does not run")
    })

    it("hold a conversation row of the world and replace or add one", () => {
        const world = memoryWorld()
        expect(conversationOf(world, "c2")).toEqual(HANDLED_ROW)
        putConversation(world, { ...HANDLED_ROW, handledBy: null })
        putConversation(world, { ...HANDLED_ROW, id: "c9" })
        expect(conversationOf(world, "c2")).toMatchObject({ handledBy: null })
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
        expect(await source.counts(THREADS_SHAPE, "status", QUERY)).toEqual({ needs: 1, handled: 1, ai: 2 })
        world.conversations.push({ ...recordOfThread(HANDLED_ROW), id: "bad", data: { name: 1 } })
        expect((await source.page(THREADS_SHAPE, { ...QUERY, size: 9 })).rows).toHaveLength(4)
    })

    it("record the jobs and the sends, and answer for the door what the world says", async () => {
        const world = memoryWorld()
        const { outbox, door } = portsOf(memoryProvider(world), { outbox: outboxPort, door: doorPort })
        await outbox.enqueue(DELIVER_REPLY, { messageId: "m1" })
        expect(world.jobs).toEqual([{ job: "chatbot.deliver-reply", input: { messageId: "m1" } }])
        expect(await door.call("chat.send", { conversationId: "c1", text: "Hi", key: "k" })).toEqual({
            ok: true,
            output: null,
        })
        expect(world.sends).toEqual([{ tool: "chat.send", input: { conversationId: "c1", text: "Hi", key: "k" } }])
    })

    it("answer for the members and nobody else, and provide the entity ports", async () => {
        const provider = memoryProvider(memoryWorld())
        const { members } = portsOf(provider, { members: membersPort })
        expect(await members.get("nobody")).toBeNull()
        expect(await members.get("member-manager")).toEqual({ displayName: "Lan Pham", isManager: true })
        for (const port of [THREADS_LIST, CONVERSATIONS, MESSAGES])
            expect(provider.implementationOf(port)).toBeDefined()
    })

    it("refuse a port outside the module", () => {
        expect(() => memoryProvider(memoryWorld()).implementationOf(definePort<string>("other.port"))).toThrow()
    })
})
