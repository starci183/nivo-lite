import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { HANDLED_ROW, WAITING_ROW } from "../fixtures/chatbot.fixtures"
import {
    MANAGER_ID,
    STAFF_CONTEXT,
    STAFF_ID,
    conversationApi,
    conversationOf,
    memoryProvider,
    memoryWorld,
    noteApi,
    recordOfThread,
} from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { CONVERSATIONS, NOTES } from "../ports"
import { HANDOFF } from "./handoff.action"
import { RELEASE } from "./release.action"
import { CHATBOT_NOTE_ENTITY } from "../../../entities/chat/chatbot-entity-names"

const handoff = (world: MemoryWorld, input: unknown, memberId: string | null = STAFF_ID) =>
    HANDOFF.execute?.(memoryProvider(world, memberId ?? STAFF_ID), input, { ...STAFF_CONTEXT, memberId })

const release = (world: MemoryWorld, input: unknown, memberId: string | null = STAFF_ID) =>
    RELEASE.execute?.(memoryProvider(world, memberId ?? STAFF_ID), input, { ...STAFF_CONTEXT, memberId })

/** A provider whose port `id` is the given api, every other port the world's. */
const overriding = (world: MemoryWorld, id: string, api: object, actor = STAFF_ID): PortProvider => {
    const base = memoryProvider(world, actor)
    return { implementationOf: (port) => (port.id === id ? api : base.implementationOf(port)) }
}

/** The route of the waiting conversation (free) and of the held one (the staff member holds it in the default world). */
const FREE_ROUTE = WAITING_ROW.routeId ?? ""
const HELD_ROUTE = HANDLED_ROW.routeId ?? ""

/** A world where another member (not the caller) holds the held conversation's route. */
const heldByOther = (): MemoryWorld => {
    const world = memoryWorld()
    world.holds.set(HELD_ROUTE, { memberId: "member-minh", at: "2026-11-04T00:30:00.000Z" })
    return world
}

// Design change (owner ruling R26): the chat keeps no tail of lines; a take-over or a hand-back writes the chatbot's note.
// Design change (ruling R43): who holds the thread is the ENGINE's staff hold on the route (`platform.route-holds`): the chat stores no
// holder (`handledBy` / `handledAt` gone, no dual copy), the actions call `take` / `handBack` as the caller and compare member ids; a chat
// with no route cannot be held. The answer names the holder's member id (`heldBy`).
describe("the blocks-core.chatbot.chat-handoff action", () => {
    it("takes the route over for the caller through the engine's hold and writes the notice line in one step", async () => {
        const world = memoryWorld()
        expect(await handoff(world, { id: "c1" })).toEqual({ ok: true, data: { heldBy: STAFF_ID } })
        expect(world.holds.get(FREE_ROUTE)).toMatchObject({ memberId: STAFF_ID })
        expect(conversationOf(world, "c1")).toMatchObject({
            status: "needs",
            unanswered: true,
            lastAt: "2026-11-05T03:00:00.000Z",
            version: "4",
        })
        expect(conversationOf(world, "c1")).not.toHaveProperty("handledBy")
        expect(world.notes).toMatchObject([{ data: { conversationId: "c1", kind: "taken", memberId: STAFF_ID } }])
        expect(world.notes[0]?.data["text"]).toEqual(expect.stringContaining("Thu Ha Le"))
        expect(world.links).toContainEqual({ entity: CHATBOT_NOTE_ENTITY, id: "n1", relation: "conversation", to: "c1" })
        expect(world.jobs).toEqual([])
    })

    it("words the notice in the language asked, Vietnamese by default", async () => {
        const english = memoryWorld()
        await handoff(english, { id: "c1", locale: "en" })
        expect(english.notes[0]?.data["text"]).toBe("Thu Ha Le took over the conversation.")
        const vietnamese = memoryWorld()
        await handoff(vietnamese, { id: "c1" })
        expect(vietnamese.notes[0]?.data["text"]).not.toBe("Thu Ha Le took over the conversation.")
    })

    it("changes nothing when the member already holds the route", async () => {
        const world = memoryWorld()
        expect(await handoff(world, { id: "c2" })).toEqual({ ok: true, data: { heldBy: STAFF_ID } })
        expect(world.notes).toEqual([])
        expect(conversationOf(world, "c2")).toEqual(HANDLED_ROW)
    })

    it("lets a manager take over a route another person holds, and refuses staff", async () => {
        const manager = heldByOther()
        expect(await handoff(manager, { id: "c2" }, MANAGER_ID)).toEqual({ ok: true, data: { heldBy: MANAGER_ID } })
        expect(manager.holds.get(HELD_ROUTE)).toMatchObject({ memberId: MANAGER_ID })
        const staff = heldByOther()
        expect(await handoff(staff, { id: "c2" })).toEqual({ ok: false, reason: "forbidden", message: { key: "reply_held_by_other" } })
        expect(staff.holds.get(HELD_ROUTE)).toMatchObject({ memberId: "member-minh" })
    })

    it("refuses an unknown conversation, a chat with no route, and a caller who is no member", async () => {
        expect(await handoff(memoryWorld(), { id: "nope" })).toMatchObject({ reason: "refused" })
        expect(await handoff(memoryWorld(), { id: "c3" })).toMatchObject({ reason: "refused", message: { key: "reply_not_found" } })
        expect(await handoff(memoryWorld(), { id: "c1" }, "stranger")).toMatchObject({ reason: "forbidden" })
        expect(await handoff(memoryWorld(), { id: "c1" }, null)).toMatchObject({ reason: "forbidden" })
    })

    it("asks the engine nothing and writes nothing when the conversation moved meanwhile", async () => {
        const world = heldByOther()
        const stale = overriding(
            world,
            CONVERSATIONS.id,
            { ...conversationApi(world), get: () => Promise.resolve(recordOfThread({ ...HANDLED_ROW, version: "0" })) },
            MANAGER_ID,
        )
        const result = await HANDOFF.execute?.(stale, { id: "c2" }, { ...STAFF_CONTEXT, memberId: MANAGER_ID })
        expect(result).toEqual({ ok: false, reason: "conflict", message: { key: "handling_conflict" } })
        expect(world.holds.get(HELD_ROUTE)).toMatchObject({ memberId: "member-minh" })
        expect(world.notes).toEqual([])
    })

    it("refuses the whole action when the notice line (the note) cannot be stored", async () => {
        const world = memoryWorld()
        const refused = overriding(world, NOTES.id, { ...noteApi(world), insert: () => Promise.resolve({ ok: false, reason: "invalid" }) })
        expect(await HANDOFF.execute?.(refused, { id: "c1" }, STAFF_CONTEXT)).toMatchObject({ ok: false, reason: "conflict" })
    })

    it("declares what the screen fetches again", () => {
        expect(HANDOFF.refreshes).toEqual(
            expect.arrayContaining(["blocks-core.chatbot.api.chat.list", "blocks-core.chatbot.api.chat.get", "blocks-core.chatbot.api.message.list"]),
        )
        expect(HANDOFF.transactional).toBe(true)
    })
})

describe("the blocks-core.chatbot.chat-release action", () => {
    it("hands the route back to the agent through the engine and writes the notice line", async () => {
        const world = memoryWorld()
        expect(await release(world, { id: "c2", locale: "en" })).toEqual({ ok: true, data: { heldBy: null } })
        expect(world.holds.has(HELD_ROUTE)).toBe(false)
        expect(conversationOf(world, "c2")).toMatchObject({ status: "ai", lastAt: "2026-11-05T03:00:00.000Z" })
        expect(world.notes[0]?.data).toMatchObject({ kind: "released", text: "Thu Ha Le handed the conversation back to the AI." })
    })

    it("changes nothing for a route nobody holds", async () => {
        const world = memoryWorld()
        expect(await release(world, { id: "c1" })).toEqual({ ok: true, data: { heldBy: null } })
        expect(world.notes).toEqual([])
    })

    it("refuses staff a route another person holds, and lets a manager hand it back", async () => {
        expect(await release(heldByOther(), { id: "c2" })).toMatchObject({ ok: false, reason: "forbidden" })
        const manager = heldByOther()
        expect(await release(manager, { id: "c2" }, MANAGER_ID)).toEqual({ ok: true, data: { heldBy: null } })
        expect(manager.holds.has(HELD_ROUTE)).toBe(false)
    })

    it("is a different action from the hand-off, with its own words", () => {
        expect(RELEASE.id).toBe("blocks-core.chatbot.chat-release")
        expect(RELEASE.label).toEqual({ key: "action_release" })
        expect(HANDOFF.label).toEqual({ key: "action_handoff" })
    })
})
