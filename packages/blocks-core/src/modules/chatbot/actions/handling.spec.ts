import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { MANAGER_ID, STAFF_CONTEXT, conversationStore, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import { CONVERSATIONS } from "../ports"
import { HANDOFF } from "./handoff.action"
import { RELEASE } from "./release.action"

const handoff = (
    world: ReturnType<typeof memoryWorld>,
    input: unknown,
    memberId: string | null = STAFF_CONTEXT.memberId,
) => HANDOFF.execute?.(memoryProvider(world), input, { ...STAFF_CONTEXT, memberId })

const release = (
    world: ReturnType<typeof memoryWorld>,
    input: unknown,
    memberId: string | null = STAFF_CONTEXT.memberId,
) => RELEASE.execute?.(memoryProvider(world), input, { ...STAFF_CONTEXT, memberId })

describe("the chatbot.handoff action", () => {
    it("takes the conversation over under the member name and writes the notice line in one step", async () => {
        const world = memoryWorld()
        expect(await handoff(world, { id: "c1" })).toEqual({ ok: true, data: { handledBy: "L\u00ea Thu H\u00e0" } })
        expect(world.conversations.get("c1")).toMatchObject({
            handledBy: "L\u00ea Thu H\u00e0",
            handledAt: "2026-11-05T03:00:00.000Z",
            status: "needs",
            unanswered: true,
            lastAt: "2026-11-05T03:00:00.000Z",
            lastText: "Ch\u1eadu n\u00e0y c\u00f3 b\u1ea3o h\u00e0nh r\u1ec5 kh\u00f4ng \u1ea1?",
            messageCount: 5,
            version: "4",
        })
        expect(world.lines).toMatchObject([{ conversationId: "c1", role: "system", authorKind: null }])
        expect(world.lines[0]?.text).toContain("L\u00ea Thu H\u00e0")
        expect(world.jobs).toEqual([])
    })

    it("words the notice in the language asked, Vietnamese by default", async () => {
        const english = memoryWorld()
        await handoff(english, { id: "c3", locale: "en" })
        expect(english.lines[0]?.text).toBe("L\u00ea Thu H\u00e0 took over the conversation.")
        const vietnamese = memoryWorld()
        await handoff(vietnamese, { id: "c3" })
        expect(vietnamese.lines[0]?.text).not.toBe("L\u00ea Thu H\u00e0 took over the conversation.")
        expect(vietnamese.conversations.get("c3")).toMatchObject({
            status: "handled",
            lastText: "D\u1ea1 b\u00ean em giao \u0110\u00e0 N\u1eb5ng trong hai ng\u00e0y \u1ea1.",
            lastAt: "2026-11-05T03:00:00.000Z",
        })
    })

    it("changes nothing when the member already holds the conversation", async () => {
        const world = memoryWorld()
        expect(await handoff(world, { id: "c2" })).toEqual({ ok: true, data: { handledBy: "L\u00ea Thu H\u00e0" } })
        expect(world.lines).toEqual([])
        expect(world.conversations.get("c2")).toBe(HANDLED_ROW)
    })

    it("lets a manager take over a conversation another person holds, and refuses staff", async () => {
        const manager = memoryWorld()
        expect(await handoff(manager, { id: "c2" }, MANAGER_ID)).toEqual({ ok: true, data: { handledBy: "Lan Pham" } })
        const staff = memoryWorld()
        staff.conversations.set("c2", { ...HANDLED_ROW, handledBy: "Minh" })
        expect(await handoff(staff, { id: "c2" })).toEqual({
            ok: false,
            reason: "forbidden",
            message: { key: "reply_held_by_other" },
        })
    })

    it("refuses an unknown conversation and a caller who is no member", async () => {
        expect(await handoff(memoryWorld(), { id: "nope" })).toMatchObject({ reason: "refused" })
        expect(await handoff(memoryWorld(), { id: "c1" }, "stranger")).toMatchObject({ reason: "forbidden" })
        expect(await handoff(memoryWorld(), { id: "c1" }, null)).toMatchObject({ reason: "forbidden" })
    })

    it("writes nothing when the conversation moved meanwhile", async () => {
        const world = memoryWorld()
        const base = memoryProvider(world)
        const stale: PortProvider = {
            implementationOf: (port) =>
                port.id === CONVERSATIONS.id
                    ? { ...conversationStore(world), get: () => Promise.resolve({ ...HANDLED_ROW, version: "0" }) }
                    : base.implementationOf(port),
        }
        const result = await HANDOFF.execute?.(stale, { id: "c2" }, { ...STAFF_CONTEXT, memberId: MANAGER_ID })
        expect(result).toEqual({ ok: false, reason: "conflict", message: { key: "handling_conflict" } })
        expect(world.lines).toEqual([])
    })

    it("declares what the screen fetches again", () => {
        expect(HANDOFF.refreshes).toEqual(
            expect.arrayContaining(["chatbot.threads", "chatbot.thread", "chatbot.messages"]),
        )
        expect(HANDOFF.transactional).toBe(true)
    })
})

describe("the chatbot.release action", () => {
    it("hands the conversation back to the AI and writes the notice line", async () => {
        const world = memoryWorld()
        expect(await release(world, { id: "c2", locale: "en" })).toEqual({ ok: true, data: { handledBy: null } })
        expect(world.conversations.get("c2")).toMatchObject({
            handledBy: null,
            handledAt: null,
            status: "ai",
            lastText: "Chi\u1ec1u nay em s\u1ebd g\u1eedi h\u00f3a \u0111\u01a1n cho ch\u1ecb \u1ea1.",
        })
        expect(world.lines[0]).toMatchObject({
            role: "system",
            text: "L\u00ea Thu H\u00e0 handed the conversation back to the AI.",
        })
    })

    it("changes nothing for a conversation the AI already answers", async () => {
        const world = memoryWorld()
        expect(await release(world, { id: "c3" })).toEqual({ ok: true, data: { handledBy: null } })
        expect(world.lines).toEqual([])
    })

    it("refuses staff a conversation another person holds", async () => {
        const world = memoryWorld()
        world.conversations.set("c2", { ...HANDLED_ROW, handledBy: "Minh" })
        expect(await release(world, { id: "c2" })).toMatchObject({ ok: false, reason: "forbidden" })
    })

    it("is a different action from the hand-off, with its own words", () => {
        expect(RELEASE.id).toBe("chatbot.release")
        expect(RELEASE.label).toEqual({ key: "action_release" })
        expect(HANDOFF.label).toEqual({ key: "action_handoff" })
    })
})
