import type { PortDefinition, PortProvider } from "@nivo-lite/agent-sdk/port"
import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import {
    MANAGER_ID,
    STAFF_CONTEXT,
    conversationOf,
    memoryProvider,
    memoryWorld,
    messageApi,
    putConversation,
} from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { CONVERSATIONS, MESSAGES } from "../ports"
import { APPROVE_AND_SEND } from "./approve-and-send.action"
import { REJECT_PROPOSAL } from "./reject-proposal.action"

const proposedLine = {
    conversationId: "c2",
    role: "agent",
    text: "We open on day 2.",
    sentAt: "2026-11-05T01:00:00.000Z",
    authorKind: "ai",
    authorName: null,
    authorUserId: null,
    status: "proposed",
}

const worldWithProposal = async (): Promise<MemoryWorld> => {
    const world = memoryWorld()
    await messageApi(world).insert(proposedLine, { conversation: "c2" })
    return world
}

const approve = (world: MemoryWorld, input: unknown, memberId: string | null = STAFF_CONTEXT.memberId) =>
    APPROVE_AND_SEND.execute?.(memoryProvider(world), input, { ...STAFF_CONTEXT, memberId })

const reject = (world: MemoryWorld, input: unknown) =>
    REJECT_PROPOSAL.execute?.(memoryProvider(world), input, STAFF_CONTEXT)

/** A provider whose port `target` refuses every update with the given reason. */
const failingUpdate = (
    world: MemoryWorld,
    target: PortDefinition<unknown>,
    reason: "stale" | "missing",
): PortProvider => {
    const base = memoryProvider(world)
    const real = target.id === MESSAGES.id ? messageApi(world) : base.implementationOf(target)
    return {
        implementationOf: (port) =>
            port.id === target.id
                ? { ...Object(real), update: () => Promise.resolve({ ok: false, reason }) }
                : base.implementationOf(port),
    }
}

describe("the chatbot.approve-and-send action", () => {
    it("posts the proposed line, moves the conversation and enqueues one delivery, calling no channel", async () => {
        const world = await worldWithProposal()
        const result = await approve(world, { id: "m1" })
        expect(result).toEqual({ ok: true, data: { messageId: "m1" } })
        expect(world.lines[0]?.data).toMatchObject({
            status: "posted",
            text: "We open on day 2.",
            sentAt: "2026-11-05T03:00:00.000Z",
        })
        expect(world.jobs).toEqual([{ job: "chatbot.deliver-reply", input: { messageId: "m1" } }])
        expect(world.sends).toEqual([])
        expect(conversationOf(world, "c2")).toMatchObject({
            lastText: "We open on day 2.",
            lastRole: "agent",
            status: "handled",
        })
    })

    it("sends the changed words when the person edited the draft", async () => {
        const world = await worldWithProposal()
        expect(await approve(world, { id: "m1", text: "  Open day 2, 8am.  " }, MANAGER_ID)).toMatchObject({ ok: true })
        expect(world.lines[0]?.data).toMatchObject({ text: "Open day 2, 8am." })
    })

    it("refuses a caller who is not a member", async () => {
        const world = await worldWithProposal()
        expect(await approve(world, { id: "m1" }, null)).toMatchObject({ ok: false, reason: "forbidden" })
        expect(await approve(world, { id: "m1" }, "nobody")).toMatchObject({ ok: false, reason: "forbidden" })
        expect(world.jobs).toEqual([])
    })

    it("refuses a line that is gone, already posted, or not a line", async () => {
        const world = await worldWithProposal()
        expect(await approve(world, { id: "missing" })).toMatchObject({
            ok: false,
            message: { key: "proposal_closed" },
        })
        await messageApi(world).insert({ ...proposedLine, status: "posted" }, { conversation: "c2" })
        expect(await approve(world, { id: "m2" })).toMatchObject({ ok: false, message: { key: "proposal_closed" } })
        await messageApi(world).insert({ junk: 1 }, {})
        expect(await approve(world, { id: "m3" })).toMatchObject({ ok: false, message: { key: "proposal_closed" } })
    })

    it("refuses empty and too long words as invalid fields", async () => {
        const world = await worldWithProposal()
        expect(await approve(world, { id: "m1", text: "   " })).toMatchObject({
            ok: false,
            reason: "invalid",
            message: { key: "reply_empty" },
        })
        expect(await approve(world, { id: "m1", text: "x".repeat(5000) })).toMatchObject({
            ok: false,
            reason: "invalid",
            message: { key: "reply_too_long" },
        })
    })

    it("refuses when the conversation is gone or held by another person", async () => {
        const world = await worldWithProposal()
        await messageApi(world).insert({ ...proposedLine, conversationId: "gone" }, {})
        expect(await approve(world, { id: "m2" })).toMatchObject({ ok: false, message: { key: "reply_not_found" } })
        putConversation(world, { ...HANDLED_ROW, handledBy: "Minh" })
        expect(await approve(world, { id: "m1" })).toMatchObject({
            ok: false,
            reason: "forbidden",
            message: { key: "reply_held_by_other" },
        })
    })

    it("refuses as a conflict when the line moved, and enqueues nothing", async () => {
        const world = await worldWithProposal()
        const result = await APPROVE_AND_SEND.execute?.(
            failingUpdate(world, MESSAGES, "stale"),
            { id: "m1" },
            STAFF_CONTEXT,
        )
        expect(result).toMatchObject({ ok: false, reason: "conflict" })
        expect(world.jobs).toEqual([])
    })

    it("refuses when the conversation moved", async () => {
        const world = await worldWithProposal()
        const result = await APPROVE_AND_SEND.execute?.(
            failingUpdate(world, CONVERSATIONS, "stale"),
            { id: "m1" },
            STAFF_CONTEXT,
        )
        expect(result).toMatchObject({ ok: false, reason: "conflict" })
        expect(world.jobs).toEqual([])
    })
})

describe("the chatbot.reject-proposal action", () => {
    it("keeps the proposed line as a rejected one and sends nothing", async () => {
        const world = await worldWithProposal()
        expect(await reject(world, { id: "m1" })).toEqual({ ok: true })
        expect(world.lines[0]?.data).toMatchObject({ status: "rejected" })
        expect(world.jobs).toEqual([])
    })

    it("refuses a line that is not proposed", async () => {
        const world = await worldWithProposal()
        await reject(world, { id: "m1" })
        expect(await reject(world, { id: "m1" })).toMatchObject({ ok: false, message: { key: "proposal_closed" } })
        expect(await reject(world, { id: "nope" })).toMatchObject({ ok: false, message: { key: "proposal_closed" } })
    })

    it("refuses when the line moved or is gone", async () => {
        const world = await worldWithProposal()
        const stale = await REJECT_PROPOSAL.execute?.(
            failingUpdate(world, MESSAGES, "stale"),
            { id: "m1" },
            STAFF_CONTEXT,
        )
        expect(stale).toMatchObject({ ok: false, reason: "conflict" })
        const gone = await REJECT_PROPOSAL.execute?.(
            failingUpdate(world, MESSAGES, "missing"),
            { id: "m1" },
            STAFF_CONTEXT,
        )
        expect(gone).toMatchObject({ ok: false, reason: "refused" })
    })
})
