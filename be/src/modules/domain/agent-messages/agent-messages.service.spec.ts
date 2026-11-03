import {
    stored,
    withStatements,
    HUMAN_MESSAGE_VALUES as humanValues,
    AGENT_LIST_ROWS,
    LIST_CHAT_ROWS,
    TRANSCRIPT_LINES,
    FINAL_REPLY_VALUES,
} from "@tests/fixtures/builders/agent-messages-harness.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { AgentMessagesService } from "./agent-messages.service"

import { In, MoreThanOrEqual, Not } from "typeorm"

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const activity = mock<ChatActivityService>()
    const conversations = mock<AgentConversationsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentMessagesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: ChatActivityService, useValue: activity },
            { provide: AgentConversationsReadService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(AgentMessagesService), em, activity, conversations }
}

import { AgentMessagesErrorCode } from "./errors/agent-messages.error"
import { AgentMessageEntity } from "./persistence/entities"
import {
    agentWelcomeReply,
    customerMessageInLocalOffset,
    customerPriceQuestion,
    deliveredMessage,
    failedEarlierReply,
    handoverSystemMessage,
    humanWelcomeMessage,
    messageOf,
    sentEarlierReply,
} from "@tests/fixtures/builders/agent-messages.builder"

describe("AgentMessagesService listForConversations", () => {
    it("does not query when no conversations were selected", async () => {
        const { service, em } = await build()

        await expect(service.listForConversations("ws-1", [], { limit: 20 })).resolves.toEqual([])

        expect(em.find).not.toHaveBeenCalled()
    })

    it("scopes the conversation list and supplies optional filters and ordering", async () => {
        const rows = AGENT_LIST_ROWS
        const em = mockEntityManager({ find: [AgentMessageEntity, [messageOf()]] })
        const { service } = await build(em)

        await expect(service.listForConversations("ws-1", ["conv-1", "conv-2"], { limit: 20 })).resolves.toEqual(rows)
        await expect(
            service.listForConversations("ws-1", ["conv-1"], {
                since: "2026-10-12T10:00:00.000Z",
                oldestFirst: true,
                limit: 5,
            }),
        ).resolves.toEqual(rows)

        expect(em.find).toHaveBeenNthCalledWith(1, AgentMessageEntity, {
            select: { conversationId: true, role: true, body: true, createdAt: true },
            where: { workspaceId: "ws-1", conversationId: In(["conv-1", "conv-2"]) },
            order: { createdAt: "DESC", id: "ASC" },
            take: 20,
        })
        expect(em.find).toHaveBeenNthCalledWith(2, AgentMessageEntity, {
            select: { conversationId: true, role: true, body: true, createdAt: true },
            where: {
                workspaceId: "ws-1",
                conversationId: In(["conv-1"]),
                createdAt: MoreThanOrEqual(new Date("2026-10-12T10:00:00.000Z")),
            },
            order: { createdAt: "ASC", id: "ASC" },
            take: 5,
        })
    })
})
describe("AgentMessagesService listChat", () => {
    it("maps customer and system roles directly and other speakers to the agent", async () => {
        const em = mockEntityManager({
            find: [
                AgentMessageEntity,
                [customerMessageInLocalOffset(), handoverSystemMessage(), humanWelcomeMessage()],
            ],
        })
        const { service } = await build(em)

        await expect(service.listChat("ws-1", "conv-1")).resolves.toEqual(LIST_CHAT_ROWS)
        expect(em.find).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, role: true, body: true, createdAt: true },
            where: { workspaceId: "ws-1", conversationId: "conv-1" },
            order: { createdAt: "ASC", id: "ASC" },
            take: 300,
        })
    })
})
describe("AgentMessagesService storeHuman and storeHumanMessage", () => {
    it("leaves automated human-labelled replies without an account identity", async () => {
        const { service, activity } = await build()
        const { em: inside, fakes } = withStatements(mockEntityManager(), stored("human-1"))

        await expect(service.storeHuman("ws-1", "conv-1", "Welcome", "Mai", inside)).resolves.toBe("human-1")

        expect(activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", null, inside]])
        expect(fakes[0]?.callsOf("values")).toEqual([[{ ...humanValues, authorUserId: null }]])
        expect(fakes[0]?.callsOf("orIgnore")).toEqual([[]])
    })

    it("writes a person's reply through the caller's transaction", async () => {
        const { service, em, activity } = await build()
        const { em: inside, fakes } = withStatements(mockEntityManager(), stored("human-1"))

        await expect(service.storeHuman("ws-1", "conv-1", "Welcome", "Mai", inside, "user-1")).resolves.toBe("human-1")

        expect(activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", "user-1", inside]])
        expect(fakes[0]?.callsOf("values")).toEqual([[{ ...humanValues, authorUserId: "user-1" }]])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("uses the primary manager for a new reply and reuses an approved message id on retry", async () => {
        const primary = withStatements(mockEntityManager(), stored("human-1"))
        const { service, em, activity } = await build(primary.em)
        const { em: inside, fakes } = withStatements(mockEntityManager(), stored())

        await expect(service.storeHumanMessage("ws-1", "conv-1", "Welcome", "Mai")).resolves.toBe("human-1")
        await expect(
            service.storeHumanMessage("ws-1", "conv-1", "Approved", "Mai", inside, "approved-1"),
        ).resolves.toBe("approved-1")

        expect(activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", null, em]])
        expect(primary.fakes[0]?.callsOf("values")).toEqual([[{ ...humanValues, authorUserId: null }]])
        expect(fakes[0]?.callsOf("values")).toEqual([
            [{ ...humanValues, id: "approved-1", body: "Approved", authorUserId: null }],
        ])
    })

    it("requires an inserted row when the reply has no stable approval id", async () => {
        const { em, fakes } = withStatements(mockEntityManager(), stored())
        const { service } = await build(em)

        await expect(service.storeHumanMessage("ws-1", "conv-1", "Welcome", "Mai")).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
        expect(fakes[0]?.callsOf("values")).toEqual([[{ ...humanValues, authorUserId: null }]])
    })
})
describe("AgentMessagesService storeAgentMessage", () => {
    it("stores an unsolicited agent message and requires the insert's id", async () => {
        const stub = withStatements(mockEntityManager(), stored("agent-1"))
        const ok = await build(stub.em)
        const none = withStatements(mockEntityManager(), stored())
        const missing = await build(none.em)

        await expect(ok.service.storeAgentMessage("ws-1", "conv-1", "Welcome")).resolves.toBe("agent-1")
        await expect(missing.service.storeAgentMessage("ws-1", "conv-1", "Welcome")).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
        expect(ok.activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", null, ok.em]])
        expect(missing.activity.message).not.toHaveBeenCalled()
        expect(stub.fakes[0]?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", conversationId: "conv-1", role: "agent", body: "Welcome" }],
        ])
    })
})
describe("AgentMessagesService storeCustomer and storeGreeting", () => {
    it("store through the given transaction and answer the message id", async () => {
        const { service, activity } = await build()
        const { em: inside, fakes } = withStatements(mockEntityManager(), stored("m-1"), stored("m-1"), stored("g-1"))

        await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside)).resolves.toBe("m-1")
        await expect(service.storeCustomer("ws-1", "conv-1", "Test", inside, "user-1")).resolves.toBe("m-1")
        await expect(service.storeGreeting("ws-1", "conv-1", "Welcome", inside)).resolves.toBe("g-1")
        expect(fakes[0]?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", conversationId: "conv-1", role: "user", body: "Hello", authorUserId: null }],
        ])
        expect(fakes[1]?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", conversationId: "conv-1", role: "user", body: "Test", authorUserId: "user-1" }],
        ])
        expect(fakes[2]?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", conversationId: "conv-1", role: "agent", body: "Welcome" }],
        ])
        expect(activity.message.mock.calls).toEqual([
            ["ws-1", "conversation:conv-1", null, inside],
            ["ws-1", "conversation:conv-1", "user-1", inside],
            ["ws-1", "conversation:conv-1", null, inside],
        ])
    })

    it("inserts the message at the time the channel gave it, with the tie-break, through the normal insert", async () => {
        const { service, activity } = await build()
        const { em: inside, fakes } = withStatements(mockEntityManager(), stored("m-1"))
        const at = new Date("2026-11-04T00:50:00.000Z")

        await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside, "user-1", { at, tieMicros: 417 })).resolves.toBe("m-1")

        const values = evaluatedValues(fakes[0]?.callsOf("values")[0]?.[0])
        expect(values).toEqual({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "user",
            body: "Hello",
            authorUserId: "user-1",
            createdAt: "CAST(:stampAt AS timestamptz) + make_interval(secs => CAST(:stampTie AS double precision) / 1000000)",
        })
        expect(fakes[0]?.callsOf("setParameters")).toEqual([[{ stampAt: at, stampTie: 417 }]])
        expect(inside.update).not.toHaveBeenCalled()
        expect(activity.message).toHaveBeenCalledWith("ws-1", "conversation:conv-1", "user-1", inside)
    })

    it("fails loudly when the stamped insert answers no row", async () => {
        const { service } = await build()
        const { em: inside } = withStatements(mockEntityManager(), stored())

        await expect(
            service.storeCustomer("ws-1", "conv-1", "Hello", inside, null, { at: new Date(), tieMicros: 1 }),
        ).rejects.toMatchObject({ code: AgentMessagesErrorCode.NotStored })
    })

    it("leaves the time of arrival alone when the channel gave none", async () => {
        const { service } = await build()
        const { em: inside } = withStatements(mockEntityManager(), stored("m-1"))

        await service.storeCustomer("ws-1", "conv-1", "Hello", inside)

        expect(inside.query).not.toHaveBeenCalled()
    })

    it("fail loudly when the insert answers no row", async () => {
        const { service } = await build()
        const { em: inside } = withStatements(mockEntityManager(), stored())

        await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside)).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
    })
})
describe("AgentMessagesService storeReply", () => {
    it("stores a new reply and answers it as not yet sent", async () => {
        const stub = withStatements(mockEntityManager(), stored("reply-1"))
        const { service, em, activity } = await build(stub.em)

        await expect(service.storeReply("ws-1", "conv-1", "Tea is 50k", "msg-1")).resolves.toEqual({
            id: "reply-1",
            body: "Tea is 50k",
            sent: false,
        })
        expect(activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", null, em]])
        expect(stub.fakes[0]?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", conversationId: "conv-1", role: "agent", body: "Tea is 50k", inReplyTo: "msg-1" }],
        ])
        expect(stub.fakes[0]?.callsOf("orIgnore")).toEqual([[]])
    })

    it("answers the reply a previous attempt stored, with whether it already reached the customer", async () => {
        const pendingStub = withStatements(
            mockEntityManager({ findOne: [AgentMessageEntity, failedEarlierReply()] }),
            stored(),
        )
        const sentStub = withStatements(
            mockEntityManager({ findOne: [AgentMessageEntity, sentEarlierReply()] }),
            stored(),
        )
        const pending = await build(pendingStub.em)
        const sent = await build(sentStub.em)

        await expect(pending.service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({
            id: "r-0",
            body: "Old",
            sent: false,
        })
        expect(pending.activity.message).not.toHaveBeenCalled()
        await expect(sent.service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({
            id: "r-0",
            body: "Old",
            sent: true,
        })
        expect(pendingStub.em.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, body: true, deliveryStatus: true },
            where: { conversationId: "conv-1", inReplyTo: "msg-1", role: "agent" },
        })
    })

    it("fails loudly when the reply can be neither inserted nor found", async () => {
        const { em } = withStatements(mockEntityManager({ findOne: [AgentMessageEntity, null] }), stored())
        const { service } = await build(em)

        await expect(service.storeReply("ws-1", "conv-1", "x", "msg-1")).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
    })
})
describe("AgentMessagesService storeReply without returned rows", () => {
    it("reads an insert that answered no row list as not stored and answers the earlier reply", async () => {
        const { em } = withStatements(mockEntityManager({ findOne: [AgentMessageEntity, sentEarlierReply()] }), {
            execute: { raw: undefined },
        })
        const { service } = await build(em)

        await expect(service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({
            id: "r-0",
            body: "Old",
            sent: true,
        })
    })
})
describe("AgentMessagesService storedReply", () => {
    it("finds the reply to a message, or the one stored under a work item", async () => {
        const em = mockEntityManager()
        em.findOne.mockResolvedValueOnce({ body: "Reply" }).mockResolvedValueOnce(null)
        const { service } = await build(em)

        await expect(service.storedReply("conv-1", "msg-1", null)).resolves.toBe("Reply")
        await expect(service.storedReply("conv-1", "msg-1", "item-1")).resolves.toBeNull()
        expect(em.findOne.mock.calls[0]?.[1]).toMatchObject({ where: { conversationId: "conv-1", inReplyTo: "msg-1" } })
        expect(em.findOne.mock.calls[1]?.[1]).toMatchObject({ where: { id: "item-1", conversationId: "conv-1" } })
    })
})

describe("AgentMessagesService replyExists", () => {
    it("tells whether a reply to the customer message is already stored", async () => {
        const stored1 = await build(mockEntityManager({ exists: [AgentMessageEntity, true] }))
        const none = await build(mockEntityManager({ exists: [AgentMessageEntity, false] }))

        await expect(stored1.service.replyExists("conv-1", "msg-1")).resolves.toBe(true)
        await expect(none.service.replyExists("conv-1", "msg-1")).resolves.toBe(false)
        expect(stored1.em.exists).toHaveBeenCalledWith(AgentMessageEntity, {
            where: { conversationId: "conv-1", inReplyTo: "msg-1", role: "agent" },
        })
    })
})
describe("AgentMessagesService storeLine", () => {
    it("writes a system line", async () => {
        const em = mockEntityManager({ insert: [AgentMessageEntity, {}] })
        const { service, activity } = await build(em)

        await service.storeLine("ws-1", "conv-1", "Lead handed over")

        expect(em.insert).toHaveBeenCalledWith(AgentMessageEntity, {
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "system",
            body: "Lead handed over",
        })
        expect(activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", null, em]])
    })

    it("uses the supplied transaction to write a system line", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager({ insert: [AgentMessageEntity, {}] })

        await service.storeLine("ws-1", "conv-1", "Lead handed over", inside)

        expect(inside.insert).toHaveBeenCalledWith(AgentMessageEntity, {
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "system",
            body: "Lead handed over",
        })
        expect(em.insert).not.toHaveBeenCalled()
    })
})
describe("AgentMessagesService find", () => {
    it("answers a stored message, or a refusal when it is not there", async () => {
        const found = await build(mockEntityManager({ findOne: [AgentMessageEntity, messageOf()] }))
        const missing = await build(mockEntityManager({ findOne: [AgentMessageEntity, null] }))

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
        const row = deliveredMessage()
        const { service } = await build(
            mockEntityManager({ findOne: [AgentMessageEntity, Object.assign(row, { role: undefined })] }),
        )

        await expect(service.find("msg-1", "conv-1")).resolves.toMatchObject({
            value: { role: "", deliveryStatus: "sent" },
        })
    })
})
describe("AgentMessagesService transcript", () => {
    it("answers the lines oldest first, reading anything but the customer as the agent", async () => {
        const recent = [customerPriceQuestion(), agentWelcomeReply()]
        const em = mockEntityManager({ find: [AgentMessageEntity, recent] })
        const { service } = await build(em)

        await expect(service.transcript("conv-1")).resolves.toEqual(TRANSCRIPT_LINES)
        expect(em.find).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { role: true, body: true, createdAt: true },
            where: { conversationId: "conv-1", role: Not("system") },
            order: { createdAt: "DESC", id: "DESC" },
            take: 40,
        })
    })
})
describe("AgentMessagesService customerLinesOf", () => {
    it("answers the customer's messages among the ids in the order they were said, and reads nothing for no id", async () => {
        const at = new Date("2026-11-04T01:00:00.000Z")
        const em = mockEntityManager({ find: [AgentMessageEntity, [Object.assign(new AgentMessageEntity(), { id: "m-1", body: "Chào", createdAt: at })]] })
        const { service } = await build(em)

        await expect(service.customerLinesOf("conv-1", ["m-1", "m-2"])).resolves.toEqual([{ id: "m-1", body: "Chào", at }])
        expect(em.find).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, body: true, createdAt: true },
            where: { conversationId: "conv-1", id: In(["m-1", "m-2"]), role: "user" },
            order: { createdAt: "ASC", id: "ASC" },
        })
        await expect(service.customerLinesOf("conv-1", [])).resolves.toEqual([])
        expect(em.find).toHaveBeenCalledTimes(1)
    })
})

describe("AgentMessagesService lastCustomerAt", () => {
    it("answers when the customer last wrote, or a refusal when they never did", async () => {
        const wrote = await build(mockEntityManager({ findOne: [AgentMessageEntity, messageOf()] }))
        const silent = await build(mockEntityManager({ findOne: [AgentMessageEntity, null] }))

        await expect(wrote.service.lastCustomerAt("conv-1")).resolves.toEqual({
            kind: "ok",
            value: new Date("2026-10-12T10:00:00.000Z"),
        })
        await expect(silent.service.lastCustomerAt("conv-1")).resolves.toMatchObject({ kind: "refused" })
    })
})
describe("AgentMessagesService markDelivery", () => {
    it("writes sent, or failed with the reason (a generic one when none is given)", async () => {
        const em = mockEntityManager({ update: [AgentMessageEntity, { affected: 1 }] })
        const { service } = await build(em)

        await service.markDelivery("msg-1", true)
        await service.markDelivery("msg-1", false, "zalo_window_expired")
        await service.markDelivery("msg-1", false)

        expect(em.update).toHaveBeenNthCalledWith(
            1,
            AgentMessageEntity,
            { id: "msg-1" },
            { deliveryStatus: "sent", deliveryError: null },
        )
        expect(em.update).toHaveBeenNthCalledWith(
            2,
            AgentMessageEntity,
            { id: "msg-1" },
            { deliveryStatus: "failed", deliveryError: "zalo_window_expired" },
        )
        expect(em.update).toHaveBeenNthCalledWith(
            3,
            AgentMessageEntity,
            { id: "msg-1" },
            { deliveryStatus: "failed", deliveryError: "delivery_failed" },
        )
    })
})

describe("AgentMessagesService customerMessagesPerDay", () => {
    it("sums the customer messages of the counted conversations per Vietnam day and channel", async () => {
        const perConversation = [
            { conversationId: "c1", day: "2026-10-12", messages: 3 },
            { conversationId: "c2", day: "2026-10-12", messages: 1 },
            { conversationId: "c3", day: "2026-10-12", messages: 2 },
            { conversationId: "c9", day: "2026-10-12", messages: 7 },
        ]
        const { em, fakes } = withStatements(mockEntityManager(), { getRawMany: perConversation })
        const { service, conversations } = await build(em)
        conversations.customerChannelsAmong.mockResolvedValue([
            { id: "c1", channel: "facebook" },
            { id: "c2", channel: "facebook" },
            { id: "c3", channel: "zalo" },
        ])

        await expect(service.customerMessagesPerDay("ws-1", "2026-10-05", "2026-10-19")).resolves.toEqual([
            { channel: "facebook", day: "2026-10-12", messages: 4 },
            { channel: "zalo", day: "2026-10-12", messages: 2 },
        ])
        expect(conversations.customerChannelsAmong).toHaveBeenCalledWith(
            "ws-1",
            ["c1", "c2", "c3", "c9"],
            ["facebook", "zalo"],
        )
        expect(fakes[0]?.callsOf("andWhere")).toContainEqual([
            "m.createdAt >= (:from::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')",
            { from: "2026-10-05" },
        ])
        expect(fakes[0]?.callsOf("andWhere")).toContainEqual([
            "m.createdAt < (:to::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')",
            { to: "2026-10-19" },
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[5000]])
    })
})

describe("AgentMessagesService claimDelivery", () => {
    it("stores the unknown-outcome fence before granting one outbound attempt", async () => {
        const em = mockEntityManager()
        const { fakes } = withStatements(em, stored("msg-1"))
        const { service } = await build(em)
        await expect(service.claimDelivery("msg-1", "conv-1")).resolves.toBe("send")
        expect(fakes[0]?.callsOf("set")[0]).toEqual([
            { deliveryStatus: "failed", deliveryError: "delivery_outcome_unknown" },
        ])
        expect(fakes[0]?.callsOf("where")[0]).toEqual([
            "id = :messageId AND conversation_id = :conversationId",
            {
                messageId: "msg-1",
                conversationId: "conv-1",
            },
        ])
    })

    it.each([
        { row: messageOf({ deliveryStatus: "sent" }), expected: "acknowledged" },
        {
            row: messageOf({ deliveryStatus: "failed", deliveryError: "delivery_outcome_unknown" }),
            expected: "ambiguous",
        },
        { row: null, expected: "missing" },
    ])("does not grant another send for $expected", async ({ row, expected }) => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, row] })
        withStatements(em, stored())
        const { service } = await build(em)
        await expect(service.claimDelivery("msg-1", "conv-1")).resolves.toBe(expected)
    })
})

describe("AgentMessagesService storeFinalReply", () => {
    it("stores the final reply under its item once and reuses the id without another announcement", async () => {
        const stub = withStatements(mockEntityManager(), stored("item-1"), stored())
        const { service, activity, em } = await build(stub.em)
        await expect(service.storeFinalReply("ws-1", "conv-1", "Done", "item-1")).resolves.toBe("item-1")
        await expect(service.storeFinalReply("ws-1", "conv-1", "Done", "item-1")).resolves.toBe("item-1")
        expect(stub.fakes[0]?.callsOf("values")).toEqual([[FINAL_REPLY_VALUES]])
        expect(stub.fakes[1]?.callsOf("values")).toEqual([[FINAL_REPLY_VALUES]])
        expect(stub.fakes[0]?.callsOf("orIgnore")).toEqual([[]])
        expect(activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", null, em]])
    })
})

describe("AgentMessagesService node reads", () => {
    it("answers the newest messages of a conversation as rows, the author kind falling back to the role", async () => {
        const em = mockEntityManager({
            find: [
                AgentMessageEntity,
                [
                    {
                        id: "m2",
                        conversationId: "c1",
                        role: "agent",
                        authorKind: "bot",
                        body: "b",
                        createdAt: new Date(2000),
                    },
                    {
                        id: "m1",
                        conversationId: "c1",
                        role: "user",
                        authorKind: null,
                        body: "a",
                        createdAt: new Date(1000),
                    },
                ] as never,
            ],
        })
        const { service } = await build(em)

        await expect(service.nodeRows("ws-1", "c1", 5)).resolves.toEqual([
            { id: "m2", conversationId: "c1", authorKind: "bot", body: "b", createdAt: "1970-01-01T00:00:02.000Z" },
            { id: "m1", conversationId: "c1", authorKind: "user", body: "a", createdAt: "1970-01-01T00:00:01.000Z" },
        ])
        expect(em.find).toHaveBeenCalledWith(
            AgentMessageEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", conversationId: "c1" }, take: 5 }),
        )
    })

    it("answers when the latest message was written, or null when there is none", async () => {
        const wrote = await build(
            mockEntityManager({ findOne: [AgentMessageEntity, { createdAt: new Date(3000) } as never] }),
        )
        const silent = await build(mockEntityManager({ findOne: [AgentMessageEntity, null] }))

        await expect(wrote.service.latestAt("c1")).resolves.toEqual(new Date(3000))
        await expect(silent.service.latestAt("c1")).resolves.toBeNull()
    })
})
