import { HANDLED_ROW } from "../fixtures/chatbot.fixtures"
import { JobRetry } from "@nivo-lite/agent-sdk/mutation"
import { conversationApi, doorApi, memoryWorld, putConversation, replyApi, STAFF_ID } from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { DELIVER_REPLY, DELIVER_REPLY_INPUT, deliverReply } from "./deliver-reply.job"

// Design change (owner ruling R26, MESSAGES-PLAN sections 2 and 5): the chatbot keeps no line record. A member's typed reply waits as the
// chatbot's reply work item (a job payload carries ids only, BE-QUEUES-1); the job's door call is the ONE write of the customer line
// (the engine's, `byMember` naming the member), and once handed the work item keeps no words. A refusal or an unknown outcome is the
// engine line's state, not written back here.
const KEY = "0c0a0000-0000-4000-8000-0000000000f1"
const NOW = new Date("2026-11-05T03:00:05.000Z")

const reply = async (world: MemoryWorld, conversationId = "c2"): Promise<string> => {
    const stored = await replyApi(world).insert(
        { conversationId, text: "Invoice is on its way.", memberId: STAFF_ID, key: KEY },
        { conversation: conversationId },
    )
    expect(stored.ok).toBe(true)
    return stored.ok ? stored.row.id : ""
}

const run = (world: MemoryWorld, replyId: string) =>
    deliverReply({ replies: replyApi(world), conversations: conversationApi(world), door: doorApi(world) }, { replyId }, NOW)

const RECEIPT = {
    kind: "message",
    id: "line",
    facts: { delivered: true, state: "delivered", reason: null, routeId: "r", sendKey: KEY },
}

describe("deliverReply", () => {
    it("says the words with the one send tool on the route of its chat, under the send key and naming the member, then keeps no words", async () => {
        const world = memoryWorld()
        world.door = { ok: true, output: RECEIPT }
        const id = await reply(world)
        expect(await run(world, id)).toBe("sent")
        expect(world.sends).toEqual([
            {
                tool: "nivo.tool.customer.message.send",
                input: { text: "Invoice is on its way." },
                options: { onceBy: KEY, byMember: STAFF_ID, routeId: HANDLED_ROW.routeId },
            },
        ])
        expect(world.replies[0]?.data).toMatchObject({ text: "", handedAt: NOW.toISOString() })
    })

    it("addresses the contact on the chat's channel when the chat holds no route yet, and fails without a call when it holds neither", async () => {
        const world = memoryWorld()
        world.door = { ok: true, output: RECEIPT }
        putConversation(world, { ...HANDLED_ROW, id: "c6", routeId: null })
        expect(await run(world, await reply(world, "c6"))).toBe("sent")
        expect(world.sends[0]).toEqual({
            tool: "nivo.tool.customer.message.send",
            input: { contactId: HANDLED_ROW.contactId, channel: HANDLED_ROW.channel, text: "Invoice is on its way." },
            options: { onceBy: KEY, byMember: STAFF_ID },
        })

        const bare = memoryWorld()
        putConversation(bare, { ...HANDLED_ROW, id: "c7", routeId: null, contactId: null })
        expect(await run(bare, await reply(bare, "c7"))).toBe("failed")
        expect(bare.sends).toEqual([])
    })

    it("answers failed for a receipt of unknown outcome, a refusal and a refusing door, and hands the item over in each", async () => {
        for (const door of [
            { ok: true as const, output: { kind: "message", id: "line", facts: { delivered: false, state: "unknown", reason: null } } },
            { ok: true as const, output: { kind: "refused", id: "outside_window", facts: { state: "refused" } } },
            { ok: false as const, reason: "failed" as const, message: "zalo_window_expired" },
        ]) {
            const world = memoryWorld()
            world.door = door
            expect(await run(world, await reply(world))).toBe("failed")
            expect(world.replies[0]?.data).toMatchObject({ text: "", handedAt: NOW.toISOString() })
        }
    })

    it("sends nothing twice: a reply already handed is skipped", async () => {
        const world = memoryWorld()
        world.door = { ok: true, output: RECEIPT }
        const id = await reply(world)
        await run(world, id)
        expect(await run(world, id)).toBe("skipped")
        expect(world.sends).toHaveLength(1)
    })

    it("leaves the reply as it was when the channel may succeed later, and asks again under the same send key", async () => {
        const world = memoryWorld()
        world.door = { ok: false, reason: "transient", message: "channel_busy" }
        const id = await reply(world)
        expect(await run(world, id)).toBe("retry")
        expect(world.replies[0]).toMatchObject({ version: "1", data: { text: "Invoice is on its way." } })
        world.door = { ok: true, output: RECEIPT }
        expect(await run(world, id)).toBe("sent")
        expect(world.sends.map((send) => send.options?.onceBy)).toEqual([KEY, KEY])
    })

    it("skips a reply or a conversation that is gone, and a record that is not a reply", async () => {
        const world = memoryWorld()
        expect(await run(world, "nope")).toBe("skipped")
        expect(await run(world, await reply(world, "gone"))).toBe("skipped")
        world.replies.push({ ...(world.replies[0] ?? { id: "x", workspaceId: "w1", version: "1", createdAt: "", updatedAt: "", data: {} }), id: "bad", data: { text: 7 } })
        expect(await run(world, "bad")).toBe("skipped")
        expect(world.sends).toEqual([])
    })

    it("retries when the reply changed while it was handed", async () => {
        const world = memoryWorld()
        const id = await reply(world)
        const replies = { ...replyApi(world), update: () => Promise.resolve({ ok: false as const, reason: "stale" as const }) }
        const outcome = await deliverReply({ replies, conversations: conversationApi(world), door: doorApi(world) }, { replyId: id }, NOW)
        expect(outcome).toBe("retry")
    })
})

describe("the chatbot.deliver-reply job", () => {
    it("declares its name, its input of one reply id and the ports it runs on", () => {
        expect(DELIVER_REPLY.name).toBe("chatbot.deliver-reply")
        expect(DELIVER_REPLY_INPUT.safeParse({ replyId: "r1" }).success).toBe(true)
        expect(DELIVER_REPLY_INPUT.safeParse({ replyId: "" }).success).toBe(false)
        expect(Object.keys(DELIVER_REPLY.ports)).toEqual(["replies", "conversations", "door"])
        expect(DELIVER_REPLY.ports.door.id).toBe("engine.door")
    })

    it("delivers through its ports and finishes quietly when the reply is told", async () => {
        const world = memoryWorld()
        world.door = { ok: true, output: RECEIPT }
        const id = await reply(world)
        const ports = { replies: replyApi(world), conversations: conversationApi(world), door: doorApi(world) }
        await expect(
            DELIVER_REPLY.run(ports, { replyId: id }, { workspaceId: "w1", attempt: 1, effectKey: (step) => step }),
        ).resolves.toBeUndefined()
        expect(world.sends).toHaveLength(1)
    })

    it("throws a retry the queue reads as transient when the channel is away", async () => {
        const world = memoryWorld()
        world.door = { ok: false, reason: "transient", message: "busy" }
        const id = await reply(world)
        const ports = { replies: replyApi(world), conversations: conversationApi(world), door: doorApi(world) }
        const failed = DELIVER_REPLY.run(ports, { replyId: id }, { workspaceId: "w1", attempt: 1, effectKey: (step) => step })
        await expect(failed).rejects.toBeInstanceOf(JobRetry)
        await expect(failed).rejects.toMatchObject({ status: 503, params: { at: "chatbot.deliver-reply" } })
    })
})
