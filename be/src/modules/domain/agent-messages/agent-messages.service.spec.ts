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
import {
    CHAT_THREAD_FIND,
    COUNTED_CONVERSATIONS,
    CUSTOMER_LINES_WHERE,
    LIST_NEWEST_FIRST,
    LIST_OLDEST_SINCE,
    MESSAGES_PER_DAY,
    NODE_ROWS,
    PER_CONVERSATION_COUNTS,
    RANGE_CLAUSES,
    TRANSCRIPT_FIND,
    lineFindOptions,
    nodeMessages,
    unansweredWhere,
} from "@tests/fixtures/builders/agent-messages-service.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { AgentMessagesService } from "./agent-messages.service"

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

const onRow = (row: AgentMessageEntity | null) => build(mockEntityManager({ findOne: [AgentMessageEntity, row] }))

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
    it("reads nothing for no conversation, else scopes the list and supplies optional filters and ordering", async () => {
        const em = mockEntityManager({ find: [AgentMessageEntity, [messageOf()]] })
        const { service } = await build(em)

        await expect(service.listForConversations("ws-1", [], { limit: 20 })).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
        await expect(service.listForConversations("ws-1", ["conv-1", "conv-2"], { limit: 20 })).resolves.toEqual(
            AGENT_LIST_ROWS,
        )
        await expect(
            service.listForConversations("ws-1", ["conv-1"], {
                since: "2026-10-12T10:00:00.000Z",
                oldestFirst: true,
                limit: 5,
            }),
        ).resolves.toEqual(AGENT_LIST_ROWS)

        expect(em.find).toHaveBeenNthCalledWith(1, AgentMessageEntity, LIST_NEWEST_FIRST)
        expect(em.find).toHaveBeenNthCalledWith(2, AgentMessageEntity, LIST_OLDEST_SINCE)
    })
})
describe("AgentMessagesService listChat, transcript and the lines of a conversation", () => {
    it("maps customer and system roles directly and other speakers to the agent", async () => {
        const em = mockEntityManager({
            find: [
                AgentMessageEntity,
                [customerMessageInLocalOffset(), handoverSystemMessage(), humanWelcomeMessage()],
            ],
        })
        const { service } = await build(em)

        await expect(service.listChat("ws-1", "conv-1")).resolves.toEqual(LIST_CHAT_ROWS)
        expect(em.find).toHaveBeenCalledWith(AgentMessageEntity, CHAT_THREAD_FIND)
    })
})
describe("AgentMessagesService storeHuman and storeHumanMessage", () => {
    it("leaves automated replies without an account identity and writes a person's reply through the caller's transaction", async () => {
        const { service, em, activity } = await build()
        const automated = withStatements(mockEntityManager(), stored("human-1"))
        const person = withStatements(mockEntityManager(), stored("human-1"))

        await expect(service.storeHuman("ws-1", "conv-1", "Welcome", "Mai", automated.em)).resolves.toBe("human-1")
        await expect(service.storeHuman("ws-1", "conv-1", "Welcome", "Mai", person.em, "user-1")).resolves.toBe(
            "human-1",
        )

        expect(activity.message.mock.calls).toEqual([
            ["ws-1", "conversation:conv-1", null, automated.em],
            ["ws-1", "conversation:conv-1", "user-1", person.em],
        ])
        expect(automated.fakes[0]?.callsOf("values")).toEqual([[{ ...humanValues, authorUserId: null }]])
        expect(automated.fakes[0]?.callsOf("orIgnore")).toEqual([[]])
        expect(person.fakes[0]?.callsOf("values")).toEqual([[{ ...humanValues, authorUserId: "user-1" }]])
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

    it("stores an unsolicited agent message and requires the insert's id", async () => {
        const stub = withStatements(mockEntityManager(), stored("agent-1"))
        const ok = await build(stub.em)
        const missing = await build(withStatements(mockEntityManager(), stored()).em)

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
    const row = { workspaceId: "ws-1", conversationId: "conv-1" }

    it("store through the given transaction and answer the message id", async () => {
        const { service, activity } = await build()
        const { em: inside, fakes } = withStatements(mockEntityManager(), stored("m-1"), stored("m-1"), stored("g-1"))

        await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside)).resolves.toBe("m-1")
        await expect(service.storeCustomer("ws-1", "conv-1", "Test", inside, "user-1")).resolves.toBe("m-1")
        await expect(service.storeGreeting("ws-1", "conv-1", "Welcome", inside)).resolves.toBe("g-1")

        expect(fakes.map((fake) => fake.callsOf("values"))).toEqual([
            [[{ ...row, role: "user", body: "Hello", authorUserId: null }]],
            [[{ ...row, role: "user", body: "Test", authorUserId: "user-1" }]],
            [[{ ...row, role: "agent", body: "Welcome" }]],
        ])
        expect(inside.query).not.toHaveBeenCalled()
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

        await expect(
            service.storeCustomer("ws-1", "conv-1", "Hello", inside, "user-1", { at, tieMicros: 417 }),
        ).resolves.toBe("m-1")

        expect(evaluatedValues(fakes[0]?.callsOf("values")[0]?.[0])).toEqual({
            ...row,
            role: "user",
            body: "Hello",
            authorUserId: "user-1",
            createdAt:
                "CAST(:stampAt AS timestamptz) + make_interval(secs => CAST(:stampTie AS double precision) / 1000000)",
        })
        expect(fakes[0]?.callsOf("setParameters")).toEqual([[{ stampAt: at, stampTie: 417 }]])
        expect(inside.update).not.toHaveBeenCalled()
        expect(activity.message).toHaveBeenCalledWith("ws-1", "conversation:conv-1", "user-1", inside)
    })

    it.each([{ stamp: { at: new Date("2026-11-04T00:50:00.000Z"), tieMicros: 1 } }, { stamp: undefined }])(
        "fails loudly when the insert answers no row (stamp: $stamp)",
        async ({ stamp }) => {
            const { service } = await build()
            const { em: inside } = withStatements(mockEntityManager(), stored())

            await expect(service.storeCustomer("ws-1", "conv-1", "Hello", inside, null, stamp)).rejects.toMatchObject({
                code: AgentMessagesErrorCode.NotStored,
            })
        },
    )
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

    it.each([
        { name: "not yet", earlier: failedEarlierReply(), sent: false },
        { name: "already", earlier: sentEarlierReply(), sent: true },
    ])("answers the reply a previous attempt stored, $name reached the customer", async ({ earlier, sent }) => {
        const stub = withStatements(mockEntityManager({ findOne: [AgentMessageEntity, earlier] }), stored())
        const { service, activity, em } = await build(stub.em)

        await expect(service.storeReply("ws-1", "conv-1", "New", "msg-1")).resolves.toEqual({
            id: "r-0",
            body: "Old",
            sent,
        })
        expect(activity.message).not.toHaveBeenCalled()
        expect(em.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, body: true, deliveryStatus: true },
            where: { conversationId: "conv-1", inReplyTo: "msg-1", role: "agent" },
        })
    })

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

    it("fails loudly when the reply can be neither inserted nor found", async () => {
        const { em } = withStatements(mockEntityManager({ findOne: [AgentMessageEntity, null] }), stored())
        const { service } = await build(em)

        await expect(service.storeReply("ws-1", "conv-1", "x", "msg-1")).rejects.toMatchObject({
            code: AgentMessagesErrorCode.NotStored,
        })
    })
})
describe("AgentMessagesService reads of one message", () => {
    it("finds the reply to a message, or the one stored under a work item", async () => {
        const em = mockEntityManager()
        em.findOne.mockResolvedValueOnce({ body: "Reply" }).mockResolvedValueOnce(null)
        const { service } = await build(em)

        await expect(service.storedReply("conv-1", "msg-1", null)).resolves.toBe("Reply")
        await expect(service.storedReply("conv-1", "msg-1", "item-1")).resolves.toBeNull()
        expect(em.findOne.mock.calls[0]?.[1]).toMatchObject({ where: { conversationId: "conv-1", inReplyTo: "msg-1" } })
        expect(em.findOne.mock.calls[1]?.[1]).toMatchObject({ where: { id: "item-1", conversationId: "conv-1" } })
    })

    it("tells whether a reply to the customer message is already stored", async () => {
        const stored1 = await build(mockEntityManager({ exists: [AgentMessageEntity, true] }))
        const none = await build(mockEntityManager({ exists: [AgentMessageEntity, false] }))

        await expect(stored1.service.replyExists("conv-1", "msg-1")).resolves.toBe(true)
        await expect(none.service.replyExists("conv-1", "msg-1")).resolves.toBe(false)
        expect(stored1.em.exists).toHaveBeenCalledWith(AgentMessageEntity, {
            where: { conversationId: "conv-1", inReplyTo: "msg-1", role: "agent" },
        })
    })

    it("answers a stored message, or a refusal when it is not there, reading a row without a role as an empty role", async () => {
        const found = await onRow(messageOf())
        const missing = await onRow(null)
        const roleless = await onRow(Object.assign(deliveredMessage(), { role: undefined }))

        await expect(found.service.find("msg-1", "conv-1")).resolves.toEqual({
            kind: "ok",
            value: { id: "msg-1", role: "user", body: "Hello", deliveryStatus: null },
        })
        await expect(missing.service.find("msg-1", "conv-1")).resolves.toMatchObject({
            kind: "refused",
            code: AgentMessagesErrorCode.NotFound,
        })
        await expect(roleless.service.find("msg-1", "conv-1")).resolves.toMatchObject({
            value: { role: "", deliveryStatus: "sent" },
        })
    })

    it("answers when the customer last wrote, or a refusal when they never did", async () => {
        const wrote = await onRow(messageOf())
        const silent = await onRow(null)

        await expect(wrote.service.lastCustomerAt("conv-1")).resolves.toEqual({
            kind: "ok",
            value: new Date("2026-10-12T10:00:00.000Z"),
        })
        await expect(silent.service.lastCustomerAt("conv-1")).resolves.toMatchObject({ kind: "refused" })
    })
})
describe("AgentMessagesService storeLine", () => {
    const line = { workspaceId: "ws-1", conversationId: "conv-1", role: "system", body: "Lead handed over" }

    it("writes a system line through the primary manager, or through the supplied transaction", async () => {
        const primary = mockEntityManager({ insert: [AgentMessageEntity, {}] })
        const inside = mockEntityManager({ insert: [AgentMessageEntity, {}] })
        const { service, activity, em } = await build(primary)

        await service.storeLine("ws-1", "conv-1", "Lead handed over")
        await service.storeLine("ws-1", "conv-1", "Lead handed over", inside)

        expect(em.insert).toHaveBeenCalledTimes(1)
        expect(em.insert).toHaveBeenCalledWith(AgentMessageEntity, line)
        expect(inside.insert).toHaveBeenCalledWith(AgentMessageEntity, line)
        expect(activity.message.mock.calls).toEqual([
            ["ws-1", "conversation:conv-1", null, em],
            ["ws-1", "conversation:conv-1", null, inside],
        ])
    })

    it("answers the lines oldest first, reading anything but the customer as the agent", async () => {
        const recent = [customerPriceQuestion(), agentWelcomeReply()]
        const em = mockEntityManager({ find: [AgentMessageEntity, recent] })
        const { service } = await build(em)

        await expect(service.transcript("conv-1")).resolves.toEqual(TRANSCRIPT_LINES)
        expect(em.find).toHaveBeenCalledWith(AgentMessageEntity, TRANSCRIPT_FIND)
    })

    it("answers the customer's messages among the ids in the order they were said, and reads nothing for no id", async () => {
        const at = new Date("2026-11-04T01:00:00.000Z")
        const em = mockEntityManager({
            find: [AgentMessageEntity, [messageOf({ id: "m-1", body: "Hi", createdAt: at })]],
        })
        const { service } = await build(em)

        await expect(service.customerLinesOf("conv-1", ["m-1", "m-2"])).resolves.toEqual([
            { id: "m-1", body: "Hi", at },
        ])
        expect(em.find).toHaveBeenCalledWith(AgentMessageEntity, lineFindOptions(CUSTOMER_LINES_WHERE, 2))
        await expect(service.customerLinesOf("conv-1", [])).resolves.toEqual([])
        expect(em.find).toHaveBeenCalledTimes(1)
    })

    it("answers the customer's messages said after the agent's last reply, in the order said", async () => {
        const replied = new Date("2026-11-04T01:00:00.000Z")
        const later = new Date("2026-11-04T01:00:03.000Z")
        const em = mockEntityManager({
            findOne: [AgentMessageEntity, messageOf({ createdAt: replied })],
            find: [AgentMessageEntity, [messageOf({ id: "m-2", body: "In stock?", createdAt: later })]],
        })
        const { service } = await build(em)

        await expect(service.unansweredLinesOf("conv-1", 30)).resolves.toEqual([
            { id: "m-2", body: "In stock?", at: later },
        ])
        expect(em.find).toHaveBeenCalledWith(AgentMessageEntity, lineFindOptions(unansweredWhere(replied), 30))
    })

    it("answers every customer message of a conversation the agent never replied in", async () => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, null], find: [AgentMessageEntity, []] })
        const { service } = await build(em)

        await service.unansweredLinesOf("conv-1", 30)

        expect(em.find).toHaveBeenCalledWith(
            AgentMessageEntity,
            expect.objectContaining({ where: { conversationId: "conv-1", role: "user" } }),
        )
    })
})

describe("AgentMessagesService markDelivery", () => {
    it.each([
        { delivered: true, error: undefined, written: { deliveryStatus: "sent", deliveryError: null } },
        { delivered: false, error: "late", written: { deliveryStatus: "failed", deliveryError: "late" } },
        { delivered: false, error: undefined, written: { deliveryStatus: "failed", deliveryError: "delivery_failed" } },
    ])("writes $written (a generic reason when none is given)", async ({ delivered, error, written }) => {
        const em = mockEntityManager({ update: [AgentMessageEntity, { affected: 1 }] })
        const { service } = await build(em)

        await service.markDelivery("msg-1", delivered, error)

        expect(em.update).toHaveBeenCalledWith(AgentMessageEntity, { id: "msg-1" }, written)
    })
})

describe("AgentMessagesService customerMessagesPerDay", () => {
    it("sums the customer messages of the counted conversations per Vietnam day and channel", async () => {
        const { em, fakes } = withStatements(mockEntityManager(), { getRawMany: PER_CONVERSATION_COUNTS })
        const { service, conversations } = await build(em)
        conversations.customerChannelsAmong.mockResolvedValue([...COUNTED_CONVERSATIONS])

        await expect(service.customerMessagesPerDay("ws-1", "2026-10-05", "2026-10-19")).resolves.toEqual(
            MESSAGES_PER_DAY,
        )
        expect(conversations.customerChannelsAmong).toHaveBeenCalledWith(
            "ws-1",
            ["c1", "c2", "c3", "c9"],
            ["facebook", "zalo"],
        )
        expect(fakes[0]?.callsOf("andWhere")).toEqual(expect.arrayContaining(RANGE_CLAUSES))
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
            { messageId: "msg-1", conversationId: "conv-1" },
        ])
    })

    it.each([
        { row: messageOf({ deliveryStatus: "sent" }), expected: "acknowledged" },
        { row: messageOf({ deliveryStatus: "failed", deliveryError: "zalo_error" }), expected: "ambiguous" },
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
        expect(stub.fakes.map((fake) => fake.callsOf("values"))).toEqual([
            [[FINAL_REPLY_VALUES]],
            [[FINAL_REPLY_VALUES]],
        ])
        expect(stub.fakes[0]?.callsOf("orIgnore")).toEqual([[]])
        expect(activity.message.mock.calls).toEqual([["ws-1", "conversation:conv-1", null, em]])
    })
})

describe("AgentMessagesService node reads", () => {
    it("answers the newest messages of a conversation as rows, the author kind falling back to the role", async () => {
        const em = mockEntityManager({ find: [AgentMessageEntity, nodeMessages()] })
        const { service } = await build(em)

        await expect(service.nodeRows("ws-1", "c1", 5)).resolves.toEqual(NODE_ROWS)
        expect(em.find).toHaveBeenCalledWith(
            AgentMessageEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", conversationId: "c1" }, take: 5 }),
        )
    })

    it("answers when the latest message was written, or null when there is none", async () => {
        const wrote = await onRow(messageOf({ createdAt: new Date(3000) }))
        const silent = await onRow(null)

        await expect(wrote.service.latestAt("conv-1")).resolves.toEqual(new Date(3000))
        await expect(silent.service.latestAt("conv-1")).resolves.toBeNull()
    })
})
