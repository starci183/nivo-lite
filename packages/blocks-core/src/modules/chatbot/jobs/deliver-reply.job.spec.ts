import { WAITING_ROW } from "../fixtures/chatbot.fixtures"
import { JobRetry } from "@nivo-lite/agent-sdk/mutation"
import {
    conversationApi,
    doorApi,
    memoryWorld,
    messageApi,
    putConversation,
    recordOfThread,
} from "../fixtures/chatbot.memory"
import type { MemoryWorld } from "../fixtures/chatbot.memory"
import { DELIVER_REPLY, DELIVER_REPLY_INPUT, RECIPIENT_NOT_LINKED, deliverReply } from "./deliver-reply.job"

const run = (world: MemoryWorld, messageId: string) =>
    deliverReply(
        { messages: messageApi(world), conversations: conversationApi(world), door: doorApi(world) },
        { messageId },
    )

const reply = async (world: MemoryWorld, conversationId = "c2"): Promise<string> => {
    const stored = await messageApi(world).insert(
        {
            conversationId,
            role: "agent",
            text: "Invoice is on its way.",
            sentAt: "2026-11-05T03:00:00.000Z",
            authorKind: "human",
            authorName: "Thu Ha Le",
            authorUserId: "member-staff",
            deliveryStatus: null,
            deliveryError: null,
        },
        { conversation: conversationId },
    )
    expect(stored.ok).toBe(true)
    return stored.ok ? stored.row.id : ""
}

describe("deliverReply", () => {
    it("pushes the line through the door tool nivo.chat.send with the line id as the key and records it sent", async () => {
        const world = memoryWorld()
        const id = await reply(world)
        expect(await run(world, id)).toBe("sent")
        expect(world.sends).toEqual([
            { tool: "nivo.chat.send", input: { conversationId: "c2", text: "Invoice is on its way.", key: id } },
        ])
        expect(world.lines[0]).toMatchObject({ version: "2", data: { deliveryStatus: "sent", deliveryError: null } })
    })

    it("sends nothing twice: a line already sent is skipped", async () => {
        const world = memoryWorld()
        const id = await reply(world)
        await run(world, id)
        expect(await run(world, id)).toBe("skipped")
        expect(world.sends).toHaveLength(1)
    })

    it("records a refusal of the channel on the line, in the words the door gave", async () => {
        const world = memoryWorld()
        world.door = { ok: false, reason: "failed", message: "zalo_window_expired" }
        const id = await reply(world)
        expect(await run(world, id)).toBe("failed")
        expect(world.lines[0]?.data).toMatchObject({ deliveryStatus: "failed", deliveryError: "zalo_window_expired" })
    })

    it("leaves the line as it was when the channel may succeed later, so the queue retries", async () => {
        const world = memoryWorld()
        world.door = { ok: false, reason: "transient", message: "channel_busy" }
        const id = await reply(world)
        expect(await run(world, id)).toBe("retry")
        expect(world.lines[0]).toMatchObject({ version: "1", data: { deliveryStatus: null } })
    })

    it("fails a line for a customer no channel can reach without calling the door", async () => {
        const world = memoryWorld()
        putConversation(world, { ...WAITING_ROW, id: "c5", externalId: "import-5" })
        const id = await reply(world, "c5")
        expect(await run(world, id)).toBe("failed")
        expect(world.sends).toEqual([])
        expect(world.lines[0]?.data).toMatchObject({ deliveryStatus: "failed", deliveryError: RECIPIENT_NOT_LINKED })
    })

    it("skips a line or a conversation that is gone, and a record that is not a line", async () => {
        const world = memoryWorld()
        expect(await run(world, "nope")).toBe("skipped")
        const id = await reply(world, "gone")
        expect(await run(world, id)).toBe("skipped")
        world.lines.push({ ...recordOfThread(WAITING_ROW), id: "bad", data: { role: 7 } })
        expect(await run(world, "bad")).toBe("skipped")
    })

    it("retries when the line changed while the outcome was recorded", async () => {
        const world = memoryWorld()
        const id = await reply(world)
        const messages = {
            ...messageApi(world),
            update: () => Promise.resolve({ ok: false as const, reason: "stale" as const }),
        }
        const outcome = await deliverReply(
            { messages, conversations: conversationApi(world), door: doorApi(world) },
            { messageId: id },
        )
        expect(outcome).toBe("retry")
    })
})

describe("the chatbot.deliver-reply job", () => {
    it("declares its name, its input of one line id and the ports it runs on", () => {
        expect(DELIVER_REPLY.name).toBe("chatbot.deliver-reply")
        expect(DELIVER_REPLY_INPUT.safeParse({ messageId: "m1" }).success).toBe(true)
        expect(DELIVER_REPLY_INPUT.safeParse({ messageId: "" }).success).toBe(false)
        expect(Object.keys(DELIVER_REPLY.ports)).toEqual(["messages", "conversations", "door"])
        expect(DELIVER_REPLY.ports.door.id).toBe("engine.door")
    })

    it("delivers through its ports and finishes quietly when the line is sent", async () => {
        const world = memoryWorld()
        const id = await reply(world)
        const ports = {
            messages: messageApi(world),
            conversations: conversationApi(world),
            door: doorApi(world),
        }
        await expect(
            DELIVER_REPLY.run(ports, { messageId: id }, { workspaceId: "w1", attempt: 1, effectKey: (step) => step }),
        ).resolves.toBeUndefined()
        expect(world.lines[0]?.data).toMatchObject({ deliveryStatus: "sent" })
    })

    it("throws a retry the queue reads as transient when the channel is away", async () => {
        const world = memoryWorld()
        world.door = { ok: false, reason: "transient", message: "busy" }
        const id = await reply(world)
        const ports = { messages: messageApi(world), conversations: conversationApi(world), door: doorApi(world) }
        const failed = DELIVER_REPLY.run(
            ports,
            { messageId: id },
            { workspaceId: "w1", attempt: 1, effectKey: (step) => step },
        )
        await expect(failed).rejects.toBeInstanceOf(JobRetry)
        await expect(failed).rejects.toMatchObject({ status: 503, at: "chatbot.deliver-reply" })
    })
})
