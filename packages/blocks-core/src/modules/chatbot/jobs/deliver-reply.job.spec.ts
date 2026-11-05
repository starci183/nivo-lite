import { chatDoor, conversationStore, memoryWorld, messageStore } from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { WAITING_ROW } from "../fixtures/chatbot.fixtures"
import { DELIVER_REPLY_INPUT, DELIVER_REPLY_PORTS, RECIPIENT_NOT_LINKED, deliverReply } from "./deliver-reply.job"

const run = (world: MemoryWorld, messageId: string) =>
    deliverReply(
        { messages: messageStore(world), conversations: conversationStore(world), door: chatDoor(world) },
        { messageId },
    )

const reply = (world: MemoryWorld, conversationId = "c2") =>
    messageStore(world).insert({
        conversationId,
        role: "agent",
        text: "Invoice is on its way.",
        sentAt: "2026-11-05T03:00:00.000Z",
        authorKind: "human",
        authorName: "Thu Ha Le",
        authorUserId: "member-staff",
    })

describe("deliverReply", () => {
    it("pushes the line through the door with the line id as the effect key and records it sent", async () => {
        const world = memoryWorld()
        const line = await reply(world)
        expect(await run(world, line.id)).toBe("sent")
        expect(world.sends).toEqual([{ conversationId: "c2", text: "Invoice is on its way.", key: line.id }])
        expect(world.lines[0]).toMatchObject({ deliveryStatus: "sent", deliveryError: null, version: "2" })
    })

    it("sends nothing twice: a line already sent is skipped", async () => {
        const world = memoryWorld()
        const line = await reply(world)
        await run(world, line.id)
        expect(await run(world, line.id)).toBe("skipped")
        expect(world.sends).toHaveLength(1)
    })

    it("records a refusal of the channel on the line", async () => {
        const world = memoryWorld()
        world.door = { ok: false, failure: "zalo_window_expired", transient: false }
        const line = await reply(world)
        expect(await run(world, line.id)).toBe("failed")
        expect(world.lines[0]).toMatchObject({ deliveryStatus: "failed", deliveryError: "zalo_window_expired" })
    })

    it("leaves the line as it was when the channel may succeed later, so the runner retries", async () => {
        const world = memoryWorld()
        world.door = { ok: false, failure: "channel_busy", transient: true }
        const line = await reply(world)
        expect(await run(world, line.id)).toBe("retry")
        expect(world.lines[0]).toMatchObject({ deliveryStatus: null, version: "1" })
    })

    it("fails a line for a customer no channel can reach without calling the door", async () => {
        const world = memoryWorld()
        world.conversations.set("c5", { ...WAITING_ROW, id: "c5", externalId: "import-5" })
        const line = await reply(world, "c5")
        expect(await run(world, line.id)).toBe("failed")
        expect(world.sends).toEqual([])
        expect(world.lines[0]).toMatchObject({ deliveryStatus: "failed", deliveryError: RECIPIENT_NOT_LINKED })
    })

    it("skips a line or a conversation that is gone", async () => {
        const world = memoryWorld()
        expect(await run(world, "nope")).toBe("skipped")
        const line = await reply(world, "gone")
        expect(await run(world, line.id)).toBe("skipped")
    })

    it("retries when the line changed while the outcome was recorded", async () => {
        const world = memoryWorld()
        const line = await reply(world)
        const messages = { ...messageStore(world), get: () => Promise.resolve({ ...line, version: "0" }) }
        const outcome = await deliverReply(
            { messages, conversations: conversationStore(world), door: chatDoor(world) },
            { messageId: line.id },
        )
        expect(outcome).toBe("retry")
    })

    it("declares its input and the ports it runs on", () => {
        expect(DELIVER_REPLY_INPUT.safeParse({ messageId: "m1" }).success).toBe(true)
        expect(DELIVER_REPLY_INPUT.safeParse({ messageId: "" }).success).toBe(false)
        expect(Object.keys(DELIVER_REPLY_PORTS)).toEqual(["messages", "conversations", "door"])
    })
})
