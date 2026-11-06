import { definePort, portsOf } from "@nivo-lite/agent-sdk/port"
import { conversationStore, memoryProvider, memoryWorld, messageStore, threadsList } from "./chatbot.memory"
import { THREADS_SHAPE } from "../reads/threads.read"
import { DOOR, LEADS, MEMBERS, OUTBOX, THREADS_LIST } from "../ports"
import type { ChatDoor } from "../ports"

const QUERY = { q: null, filters: {}, sort: "recent", cursor: null, size: 2 }

describe("the fake ports", () => {
    it("update a conversation by its version, and refuse a missing one or a stale version", async () => {
        const world = memoryWorld()
        const store = conversationStore(world)
        expect(await store.update("c3", "2", { handledBy: "Ha" })).toMatchObject({ ok: true, row: { version: "3" } })
        expect(await store.update("c3", "2", { handledBy: "Lan" })).toEqual({ ok: false, reason: "conflict" })
        expect(await store.update("nope", "1", {})).toEqual({ ok: false, reason: "missing" })
        expect(await store.get("nope")).toBeNull()
    })

    it("update a stored line by its version, and refuse a missing one or a stale version", async () => {
        const world = memoryWorld()
        const store = messageStore(world)
        const line = await store.insert({
            conversationId: "c1",
            role: "user",
            text: "Hi",
            sentAt: "2026-11-05T00:00:00.000Z",
            authorKind: null,
            authorName: null,
            authorUserId: null,
        })
        const patch = { deliveryStatus: "sent", deliveryError: null } as const
        expect(await store.update(line.id, "1", patch)).toMatchObject({ ok: true, row: { version: "2" } })
        expect(await store.update(line.id, "1", patch)).toEqual({ ok: false, reason: "conflict" })
        expect(await store.update("nope", "1", patch)).toEqual({ ok: false, reason: "missing" })
        expect(await store.get("nope")).toBeNull()
    })

    it("page the conversations by cursor and count them per status or channel", async () => {
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
    })

    it("record the jobs, the sends, and answer for the door what the world says", async () => {
        const world = memoryWorld()
        const provider = memoryProvider(world)
        const { outbox, door } = portsOf(provider, { outbox: OUTBOX, door: DOOR })
        await outbox.enqueue("chatbot.deliver-reply", { messageId: "m1" })
        expect(world.jobs).toEqual([{ messageId: "m1" }])
        expect(await door.call("chat.send", { conversationId: "c1", text: "Hi", key: "k" })).toEqual({
            ok: true,
        })
        expect(world.sends).toHaveLength(1)
    })

    it("answer for members and customers, and for nobody else", async () => {
        const provider = memoryProvider(memoryWorld())
        const { members, leads } = portsOf(provider, { members: MEMBERS, leads: LEADS })
        expect(await members.get("nobody")).toBeNull()
        expect(await leads.get("nobody")).toBeNull()
        expect(await leads.get("l1")).toMatchObject({ contactName: "Nguy\u1ec5n Minh Anh" })
        expect(provider.implementationOf(THREADS_LIST)).toBeDefined()
    })

    it("refuse a port outside the module", () => {
        expect(() => memoryProvider(memoryWorld()).implementationOf(definePort<ChatDoor>("other.port"))).toThrow()
    })
})
