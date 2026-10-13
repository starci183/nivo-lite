import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentMessagesService } from "./agent-messages.service"
import { AgentMessagesErrorCode } from "./errors/agent-messages.error"
import {
    FIND_AGENT_REPLY,
    FIND_LAST_CUSTOMER_MESSAGE,
    FIND_MESSAGE,
    INSERT_AGENT_REPLY,
    INSERT_CUSTOMER_MESSAGE,
    INSERT_GREETING_MESSAGE,
    INSERT_SYSTEM_LINE,
    LIST_TRANSCRIPT,
    MARK_MESSAGE_DELIVERY,
} from "./persistence/agent-messages.sql"

const build = async (answers: Record<string, ReadonlyArray<unknown>> = {}) => {
    const em = mockEntityManager({
        query: Object.entries({
            [INSERT_AGENT_REPLY]: [{ id: "reply-1" }],
            [FIND_AGENT_REPLY]: [],
            [INSERT_SYSTEM_LINE]: [],
            [FIND_MESSAGE]: [{ id: "msg-1", role: "user", body: "Hello", delivery_status: null }],
            [LIST_TRANSCRIPT]: [
                { role: "agent", body: "Welcome" },
                { role: "user", body: "Price?" },
            ],
            [FIND_LAST_CUSTOMER_MESSAGE]: [{ created_at: "2026-10-12T10:00:00.000Z" }],
            [MARK_MESSAGE_DELIVERY]: [],
            ...answers,
        }).map(([text, rows]) => [text, rows] as [string, unknown]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentMessagesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(AgentMessagesService), em }
}

describe("AgentMessagesService", () => {
    describe("storeCustomer and storeGreeting", () => {
        it("store through the given transaction and answer the message id", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [[INSERT_CUSTOMER_MESSAGE, [{ id: "m-1" }]], [INSERT_GREETING_MESSAGE, [{ id: "g-1" }]]] })

            await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside)).resolves.toBe("m-1")
            await expect(service.storeGreeting("ws-1", "conv-1", "Welcome", inside)).resolves.toBe("g-1")
            expect(inside.query).toHaveBeenCalledWith(INSERT_CUSTOMER_MESSAGE, ["ws-1", "conv-1", "Hello"])
        })

        it("fail loudly when the insert answers no row", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [INSERT_CUSTOMER_MESSAGE, []] })

            await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside)).rejects.toMatchObject({ code: AgentMessagesErrorCode.NotStored })
        })
    })

    describe("storeReply", () => {
        it("stores a new reply and answers it as not yet sent", async () => {
            const { service, em } = await build()

            await expect(service.storeReply("ws-1", "conv-1", "Tea is 50k", "msg-1")).resolves.toEqual({ id: "reply-1", body: "Tea is 50k", sent: false })
            expect(em.query).toHaveBeenCalledWith(INSERT_AGENT_REPLY, ["ws-1", "conv-1", "Tea is 50k", "msg-1"])
        })

        it("answers the reply a previous attempt stored, with whether it already reached the customer", async () => {
            const pending = await build({ [INSERT_AGENT_REPLY]: [], [FIND_AGENT_REPLY]: [{ id: "r-0", body: "Old", delivery_status: "failed" }] })
            const sent = await build({ [INSERT_AGENT_REPLY]: [], [FIND_AGENT_REPLY]: [{ id: "r-0", body: "Old", delivery_status: "sent" }] })

            await expect(pending.service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({ id: "r-0", body: "Old", sent: false })
            await expect(sent.service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({ id: "r-0", body: "Old", sent: true })
        })

        it("fails loudly when the reply can be neither inserted nor found", async () => {
            const { service } = await build({ [INSERT_AGENT_REPLY]: [] })

            await expect(service.storeReply("ws-1", "conv-1", "x", "msg-1")).rejects.toMatchObject({ code: AgentMessagesErrorCode.NotStored })
        })
    })

    describe("replyExists", () => {
        it("tells whether a reply to the customer message is already stored", async () => {
            const stored = await build({ [FIND_AGENT_REPLY]: [{ id: "r-0", body: "Old", delivery_status: null }] })
            const none = await build()

            await expect(stored.service.replyExists("conv-1", "msg-1")).resolves.toBe(true)
            await expect(none.service.replyExists("conv-1", "msg-1")).resolves.toBe(false)
        })
    })

    describe("storeLine", () => {
        it("writes a system line", async () => {
            const { service, em } = await build()

            await service.storeLine("ws-1", "conv-1", "Lead handed over")

            expect(em.query).toHaveBeenCalledWith(INSERT_SYSTEM_LINE, ["ws-1", "conv-1", "Lead handed over"])
        })
    })

    describe("find", () => {
        it("answers a stored message, or a refusal when it is not there", async () => {
            const found = await build()
            const missing = await build({ [FIND_MESSAGE]: [] })

            await expect(found.service.find("msg-1", "conv-1")).resolves.toEqual({
                kind: "ok",
                value: { id: "msg-1", role: "user", body: "Hello", deliveryStatus: null },
            })
            await expect(missing.service.find("msg-1", "conv-1")).resolves.toMatchObject({ kind: "refused", code: AgentMessagesErrorCode.NotFound })
        })

        it("reads a row without a role as an empty role", async () => {
            const { service } = await build({ [FIND_MESSAGE]: [{ id: "msg-1", body: "Hello", delivery_status: "sent" }] })

            await expect(service.find("msg-1", "conv-1")).resolves.toMatchObject({ value: { role: "", deliveryStatus: "sent" } })
        })
    })

    describe("transcript", () => {
        it("answers the lines oldest first, reading anything but the customer as the agent", async () => {
            const { service } = await build()

            await expect(service.transcript("conv-1")).resolves.toEqual([
                { role: "agent", body: "Welcome" },
                { role: "user", body: "Price?" },
            ])
        })
    })

    describe("lastCustomerAt", () => {
        it("answers when the customer last wrote, or a refusal when they never did", async () => {
            const wrote = await build()
            const silent = await build({ [FIND_LAST_CUSTOMER_MESSAGE]: [] })

            await expect(wrote.service.lastCustomerAt("conv-1")).resolves.toEqual({ kind: "ok", value: new Date("2026-10-12T10:00:00.000Z") })
            await expect(silent.service.lastCustomerAt("conv-1")).resolves.toMatchObject({ kind: "refused" })
        })
    })

    describe("markDelivery", () => {
        it("writes sent, or failed with the reason (a generic one when none is given)", async () => {
            const { service, em } = await build()

            await service.markDelivery("msg-1", true)
            await service.markDelivery("msg-1", false, "zalo_window_expired")
            await service.markDelivery("msg-1", false)

            expect(em.query).toHaveBeenNthCalledWith(1, MARK_MESSAGE_DELIVERY, ["msg-1", "sent", null])
            expect(em.query).toHaveBeenNthCalledWith(2, MARK_MESSAGE_DELIVERY, ["msg-1", "failed", "zalo_window_expired"])
            expect(em.query).toHaveBeenNthCalledWith(3, MARK_MESSAGE_DELIVERY, ["msg-1", "failed", "delivery_failed"])
        })
    })
})
