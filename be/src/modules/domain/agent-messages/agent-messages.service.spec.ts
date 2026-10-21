import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentMessagesService } from "./agent-messages.service"
import { AgentMessagesErrorCode } from "./errors/agent-messages.error"
import {
    COUNT_CUSTOMER_MESSAGES_PER_DAY,
    FIND_AGENT_REPLY,
    FIND_LAST_CUSTOMER_MESSAGE,
    FIND_MESSAGE,
    INSERT_AGENT_REPLY,
    INSERT_CUSTOMER_MESSAGE,
    INSERT_GREETING_MESSAGE,
    INSERT_HUMAN_MESSAGE,
    INSERT_SYSTEM_LINE,
    LIST_CHAT_MESSAGES,
    LIST_TRANSCRIPT,
    MARK_MESSAGE_DELIVERY,
} from "./persistence/agent-messages.sql"
import { LIST_CONVERSATION_MESSAGES } from "./persistence/conversation-messages.sql"

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
        }).map(([text, rows]): [string, unknown] => [text, rows]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentMessagesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(AgentMessagesService), em }
}

describe("AgentMessagesService listForConversations", () => {
    it("does not query when no conversations were selected", async () => {
        const { service, em } = await build()

        await expect(service.listForConversations("ws-1", [], { limit: 20 })).resolves.toEqual([])

        expect(em.query).not.toHaveBeenCalled()
    })

    it("scopes the conversation list and supplies optional filters and ordering", async () => {
        const rows = [{ conversation_id: "conv-1", role: "user", body: "Hello", created_at: "2026-10-12" }]
        const { service, em } = await build({ [LIST_CONVERSATION_MESSAGES]: rows })

        await expect(service.listForConversations("ws-1", ["conv-1", "conv-2"], { limit: 20 })).resolves.toEqual(rows)
        await expect(
            service.listForConversations("ws-1", ["conv-1"], {
                since: "2026-10-12T10:00:00.000Z",
                oldestFirst: true,
                limit: 5,
            }),
        ).resolves.toEqual(rows)

        expect(em.query).toHaveBeenNthCalledWith(1, LIST_CONVERSATION_MESSAGES, [
            "ws-1",
            ["conv-1", "conv-2"],
            null,
            false,
            20,
        ])
        expect(em.query).toHaveBeenNthCalledWith(2, LIST_CONVERSATION_MESSAGES, [
            "ws-1",
            ["conv-1"],
            "2026-10-12T10:00:00.000Z",
            true,
            5,
        ])
    })
})
describe("AgentMessagesService listChat", () => {
    it("maps customer and system roles directly and other speakers to the agent", async () => {
        const { service, em } = await build({
            [LIST_CHAT_MESSAGES]: [
                { id: "m-1", role: "user", body: "Hello", created_at: "2026-10-12T17:00:00+07:00" },
                { id: "m-2", role: "system", body: "Handed over", created_at: "2026-10-12T10:01:00Z" },
                { id: "m-3", role: "human", body: "Welcome", created_at: "2026-10-12T10:02:00Z" },
            ],
        })

        await expect(service.listChat("ws-1", "conv-1")).resolves.toEqual([
            { id: "m-1", role: "user", body: "Hello", createdAt: "2026-10-12T10:00:00.000Z" },
            { id: "m-2", role: "system", body: "Handed over", createdAt: "2026-10-12T10:01:00.000Z" },
            { id: "m-3", role: "agent", body: "Welcome", createdAt: "2026-10-12T10:02:00.000Z" },
        ])
        expect(em.query).toHaveBeenCalledWith(LIST_CHAT_MESSAGES, ["ws-1", "conv-1"])
    })
})
describe("AgentMessagesService storeHuman and storeHumanMessage", () => {
    it("writes a person's reply through the caller's transaction", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager({ query: [INSERT_HUMAN_MESSAGE, [{ id: "human-1" }]] })

        await expect(service.storeHuman("ws-1", "conv-1", "Welcome", "Mai", inside)).resolves.toBe("human-1")

        expect(inside.query).toHaveBeenCalledWith(INSERT_HUMAN_MESSAGE, [null, "ws-1", "conv-1", "Welcome", "Mai"])
        expect(em.query).not.toHaveBeenCalled()
    })

    it("uses the primary manager for a new reply and reuses an approved message id on retry", async () => {
        const { service, em } = await build({ [INSERT_HUMAN_MESSAGE]: [{ id: "human-1" }] })
        const inside = mockEntityManager({ query: [INSERT_HUMAN_MESSAGE, []] })

        await expect(service.storeHumanMessage("ws-1", "conv-1", "Welcome", "Mai")).resolves.toBe("human-1")
        await expect(
            service.storeHumanMessage("ws-1", "conv-1", "Approved", "Mai", inside, "approved-1"),
        ).resolves.toBe("approved-1")

        expect(em.query).toHaveBeenCalledWith(INSERT_HUMAN_MESSAGE, [null, "ws-1", "conv-1", "Welcome", "Mai"])
        expect(inside.query).toHaveBeenCalledWith(INSERT_HUMAN_MESSAGE, [
            "approved-1",
            "ws-1",
            "conv-1",
            "Approved",
            "Mai",
        ])
    })

    it("requires an inserted row when the reply has no stable approval id", async () => {
        const { service, em } = await build({ [INSERT_HUMAN_MESSAGE]: [] })

        await expect(service.storeHumanMessage("ws-1", "conv-1", "Welcome", "Mai")).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
        expect(em.query).toHaveBeenCalledWith(INSERT_HUMAN_MESSAGE, [null, "ws-1", "conv-1", "Welcome", "Mai"])
    })
})
describe("AgentMessagesService storeAgentMessage", () => {
    it("stores an unsolicited agent message and requires the insert's id", async () => {
        const stored = await build({ [INSERT_GREETING_MESSAGE]: [{ id: "agent-1" }] })
        const missing = await build({ [INSERT_GREETING_MESSAGE]: [] })

        await expect(stored.service.storeAgentMessage("ws-1", "conv-1", "Welcome")).resolves.toBe("agent-1")
        await expect(missing.service.storeAgentMessage("ws-1", "conv-1", "Welcome")).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
        expect(stored.em.query).toHaveBeenCalledWith(INSERT_GREETING_MESSAGE, ["ws-1", "conv-1", "Welcome"])
    })
})
describe("AgentMessagesService storeCustomer and storeGreeting", () => {
    it("store through the given transaction and answer the message id", async () => {
        const { service } = await build()
        const inside = mockEntityManager({
            query: [
                [INSERT_CUSTOMER_MESSAGE, [{ id: "m-1" }]],
                [INSERT_GREETING_MESSAGE, [{ id: "g-1" }]],
            ],
        })

        await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside)).resolves.toBe("m-1")
        await expect(service.storeGreeting("ws-1", "conv-1", "Welcome", inside)).resolves.toBe("g-1")
        expect(inside.query).toHaveBeenCalledWith(INSERT_CUSTOMER_MESSAGE, ["ws-1", "conv-1", "Hello"])
    })

    it("fail loudly when the insert answers no row", async () => {
        const { service } = await build()
        const inside = mockEntityManager({ query: [INSERT_CUSTOMER_MESSAGE, []] })

        await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside)).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
    })
})
describe("AgentMessagesService storeReply", () => {
    it("stores a new reply and answers it as not yet sent", async () => {
        const { service, em } = await build()

        await expect(service.storeReply("ws-1", "conv-1", "Tea is 50k", "msg-1")).resolves.toEqual({
            id: "reply-1",
            body: "Tea is 50k",
            sent: false,
        })
        expect(em.query).toHaveBeenCalledWith(INSERT_AGENT_REPLY, ["ws-1", "conv-1", "Tea is 50k", "msg-1"])
    })

    it("answers the reply a previous attempt stored, with whether it already reached the customer", async () => {
        const pending = await build({
            [INSERT_AGENT_REPLY]: [],
            [FIND_AGENT_REPLY]: [{ id: "r-0", body: "Old", delivery_status: "failed" }],
        })
        const sent = await build({
            [INSERT_AGENT_REPLY]: [],
            [FIND_AGENT_REPLY]: [{ id: "r-0", body: "Old", delivery_status: "sent" }],
        })

        await expect(pending.service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({
            id: "r-0",
            body: "Old",
            sent: false,
        })
        await expect(sent.service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({
            id: "r-0",
            body: "Old",
            sent: true,
        })
    })

    it("fails loudly when the reply can be neither inserted nor found", async () => {
        const { service } = await build({ [INSERT_AGENT_REPLY]: [] })

        await expect(service.storeReply("ws-1", "conv-1", "x", "msg-1")).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
    })
})
describe("AgentMessagesService replyExists", () => {
    it("tells whether a reply to the customer message is already stored", async () => {
        const stored = await build({ [FIND_AGENT_REPLY]: [{ id: "r-0", body: "Old", delivery_status: null }] })
        const none = await build()

        await expect(stored.service.replyExists("conv-1", "msg-1")).resolves.toBe(true)
        await expect(none.service.replyExists("conv-1", "msg-1")).resolves.toBe(false)
    })
})
describe("AgentMessagesService storeLine", () => {
    it("writes a system line", async () => {
        const { service, em } = await build()

        await service.storeLine("ws-1", "conv-1", "Lead handed over")

        expect(em.query).toHaveBeenCalledWith(INSERT_SYSTEM_LINE, ["ws-1", "conv-1", "Lead handed over"])
    })

    it("uses the supplied transaction to write a system line", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager({ query: [INSERT_SYSTEM_LINE, []] })

        await service.storeLine("ws-1", "conv-1", "Lead handed over", inside)

        expect(inside.query).toHaveBeenCalledWith(INSERT_SYSTEM_LINE, ["ws-1", "conv-1", "Lead handed over"])
        expect(em.query).not.toHaveBeenCalled()
    })
})
describe("AgentMessagesService find", () => {
    it("answers a stored message, or a refusal when it is not there", async () => {
        const found = await build()
        const missing = await build({ [FIND_MESSAGE]: [] })

        await expect(found.service.find("msg-1", "conv-1")).resolves.toEqual({
            kind: "ok",
            value: { id: "msg-1", role: "user", body: "Hello", deliveryStatus: null },
        })
        await expect(missing.service.find("msg-1", "conv-1")).resolves.toMatchObject({
            kind: "refused",
            code: AgentMessagesErrorCode.NotFound,
        })
    })

    it("reads a row without a role as an empty role", async () => {
        const { service } = await build({
            [FIND_MESSAGE]: [{ id: "msg-1", body: "Hello", delivery_status: "sent" }],
        })

        await expect(service.find("msg-1", "conv-1")).resolves.toMatchObject({
            value: { role: "", deliveryStatus: "sent" },
        })
    })
})
describe("AgentMessagesService transcript", () => {
    it("answers the lines oldest first, reading anything but the customer as the agent", async () => {
        const { service } = await build()

        await expect(service.transcript("conv-1")).resolves.toEqual([
            { role: "agent", body: "Welcome" },
            { role: "user", body: "Price?" },
        ])
    })
})
describe("AgentMessagesService lastCustomerAt", () => {
    it("answers when the customer last wrote, or a refusal when they never did", async () => {
        const wrote = await build()
        const silent = await build({ [FIND_LAST_CUSTOMER_MESSAGE]: [] })

        await expect(wrote.service.lastCustomerAt("conv-1")).resolves.toEqual({
            kind: "ok",
            value: new Date("2026-10-12T10:00:00.000Z"),
        })
        await expect(silent.service.lastCustomerAt("conv-1")).resolves.toMatchObject({ kind: "refused" })
    })
})
describe("AgentMessagesService markDelivery", () => {
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

describe("AgentMessagesService customerMessagesPerDay", () => {
    it("counts the customer messages per Vietnam day and channel", async () => {
        const rows = [
            { channel: "facebook", day: "2026-10-12", messages: 4 },
            { channel: "zalo", day: "2026-10-12", messages: 2 },
        ]
        const { service, em } = await build({ [COUNT_CUSTOMER_MESSAGES_PER_DAY]: rows })

        await expect(service.customerMessagesPerDay("ws-1", "2026-10-05", "2026-10-19")).resolves.toEqual(rows)
        expect(em.query).toHaveBeenCalledWith(COUNT_CUSTOMER_MESSAGES_PER_DAY, ["ws-1", "2026-10-05", "2026-10-19"])
    })
})
