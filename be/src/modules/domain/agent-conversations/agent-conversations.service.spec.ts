import { mock, mockEntityManager } from "@starci/jest-preset"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { Test } from "@nestjs/testing"
import { IsNull, Not } from "typeorm"
import {
    heldWebsiteChat,
    insertedChatRow,
    insertedRefRow,
    leadConversation,
    namedPartyConversation,
    quietTestChat,
    telegramConversation,
    testConversation,
    turnConversation,
    unnamedPartyConversation,
} from "@tests/fixtures/builders/agent-conversations.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentConversationsService } from "./agent-conversations.service"
import { AgentConversationsErrorCode } from "./errors/agent-conversations.error"
import { AgentConversationEntity } from "./persistence/entities"

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const agents = mock<AgentDirectoryService>()
    agents.turnFactsOf.mockResolvedValue(TURN_AGENT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentConversationsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(AgentConversationsService), em, agents }
}

/** The agent that speaks in the turn conversation. */
const TURN_AGENT = {
    id: "agent-1",
    name: "Chatbot",
    handle: "chatbot",
    role: "Customer chat",
    module: "chatbot",
    instructions: "Be kind",
    knowledge: "Tea",
    approvalRule: "ask",
    greeting: "Hi",
}

const chat = {
    id: "chat-1",
    kind: "customer",
    channel: "website",
    visitorName: "Minh",
    leadId: "lead-1",
    handledBy: "Lan",
    createdAt: "2026-10-13T02:00:00.000Z",
}

const chatInput = (kind: "customer" | "test", visitorName: string | null) => ({
    workspaceId: "ws-1",
    agentId: "agent-1",
    kind,
    visitorName,
})

const REFUSED = { kind: "refused", code: AgentConversationsErrorCode.NotFound }

describe("AgentConversationsService chat", () => {
    it("maps customer and test history, including nullable visitor and handling fields", async () => {
        const { service, em } = await build(
            mockEntityManager({ find: [AgentConversationEntity, [heldWebsiteChat(), quietTestChat()]] }),
        )

        await expect(service.listChat("ws-1", "agent-1")).resolves.toEqual([
            chat,
            { ...chat, id: "chat-2", kind: "test", visitorName: null, leadId: null, handledBy: null },
        ])
        expect(em.find).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", agentId: "agent-1" },
                order: { createdAt: "DESC", id: "DESC" },
                take: 100,
            }),
        )
    })

    it("opens the chat through the supplied transaction and maps its returned row", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager()
        const [fake] = queueQueryBuilders(inside, [{ execute: { raw: [insertedChatRow] } }])

        await expect(service.openChat(chatInput("customer", "Minh"), inside)).resolves.toEqual(chat)
        expect(fake?.callsOf("values")).toEqual([[chatInput("customer", "Minh")]])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads any kind other than customer as a test chat", async () => {
        const { service } = await build()
        const inside = mockEntityManager()
        queueQueryBuilders(inside, [{ execute: { raw: [{ ...insertedChatRow, kind: "test" }] } }])

        await expect(service.openChat(chatInput("test", "Minh"), inside)).resolves.toEqual({ ...chat, kind: "test" })
    })

    it.each([[[]], ["not rows"]])("refuses a chat insert that returned no row (%j)", async (raw) => {
        const { service } = await build()
        const inside = mockEntityManager()
        const [fake] = queueQueryBuilders(inside, [{ execute: { raw } }])

        await expect(service.openChat(chatInput("test", null), inside)).rejects.toMatchObject({
            code: AgentConversationsErrorCode.NotStored,
        })
        expect(fake?.callsOf("values")).toEqual([[chatInput("test", null)]])
    })
})

describe("AgentConversationsService chat locks", () => {
    it("locks a scoped chat through the supplied transaction", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager({ findOne: [AgentConversationEntity, heldWebsiteChat()] })

        await expect(service.lockChat("ws-1", "chat-1", inside)).resolves.toEqual(chat)
        expect(inside.findOne).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", id: "chat-1" },
                lock: { mode: "pessimistic_write" },
            }),
        )
        expect(em.findOne).not.toHaveBeenCalled()
    })

    it("refuses to lock a chat that is absent from the workspace", async () => {
        const { service } = await build()
        const inside = mockEntityManager({ findOne: [AgentConversationEntity, null] })

        await expect(service.lockChat("ws-1", "chat-1", inside)).rejects.toMatchObject({
            code: AgentConversationsErrorCode.NotFound,
        })
    })

    it("sets and clears the chat holder through the supplied transaction", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager({ update: [AgentConversationEntity, { affected: 1 }] })

        await service.setChatHolder("ws-1", "chat-1", "Lan", inside)
        await service.setChatHolder("ws-1", "chat-1", null, inside)

        const where = { workspaceId: "ws-1", id: "chat-1" }
        expect(evaluatedCalls(inside.update.mock.calls, 2)).toEqual([
            ["AgentConversationEntity", where, { handledBy: "Lan", handledAt: "now()" }],
            ["AgentConversationEntity", where, { handledBy: null, handledAt: null }],
        ])
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("AgentConversationsService customer leads", () => {
    it("lists customer lead conversations using the default or requested bound", async () => {
        const { service, em } = await build(
            mockEntityManager({ find: [AgentConversationEntity, [leadConversation()]] }),
        )
        const rows = [{ id: "conv-1", lead_id: "lead-1", handled_by: "Lan" }]

        await expect(service.listCustomerLeadConversations("ws-1")).resolves.toEqual(rows)
        await expect(service.listCustomerLeadConversations("ws-1", 12)).resolves.toEqual(rows)
        expect(em.find).toHaveBeenNthCalledWith(
            1,
            AgentConversationEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", kind: "customer", leadId: Not(IsNull()) },
                order: { createdAt: "DESC", id: "DESC" },
                take: 200,
            }),
        )
        expect(em.find).toHaveBeenNthCalledWith(2, AgentConversationEntity, expect.objectContaining({ take: 12 }))
    })

    it("maps the newest lead conversation while forwarding its optional channel", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [AgentConversationEntity, leadConversation()] }),
        )
        const expected = { id: "conv-1", agentId: "agent-1", channel: "telegram", visitorName: "Minh" }

        await expect(service.latestOfLead("ws-1", "lead-1", null)).resolves.toEqual(expected)
        await expect(service.latestOfLead("ws-1", "lead-1", "telegram")).resolves.toEqual(expected)
        const lead = { workspaceId: "ws-1", leadId: "lead-1", kind: "customer" }
        expect(em.findOne).toHaveBeenNthCalledWith(1, AgentConversationEntity, expect.objectContaining({ where: lead }))
        expect(em.findOne).toHaveBeenNthCalledWith(
            2,
            AgentConversationEntity,
            expect.objectContaining({ where: { ...lead, channel: "telegram" }, order: { createdAt: "DESC" } }),
        )
    })

    it("answers null when the lead has no matching conversation", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentConversationEntity, null] }))

        await expect(service.latestOfLead("ws-1", "lead-1", "zalo")).resolves.toBeNull()
    })
})

describe("AgentConversationsService human handling", () => {
    const where = { workspaceId: "ws-1", id: "conv-1" }

    it("maps the locked customer conversation and its current holder", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager({ findOne: [AgentConversationEntity, leadConversation()] })

        await expect(service.lockForHuman("ws-1", "conv-1", inside)).resolves.toEqual({
            id: "conv-1",
            workspaceId: "ws-1",
            channel: "telegram",
            externalId: "555",
            connectionId: "c-1",
            leadId: "lead-1",
            handledBy: "Lan",
        })
        expect(inside.findOne).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({ where: { ...where, kind: "customer" }, lock: { mode: "pessimistic_write" } }),
        )
        expect(em.findOne).not.toHaveBeenCalled()
    })

    it("answers null when no scoped customer conversation can be locked", async () => {
        const { service } = await build()
        const inside = mockEntityManager({ findOne: [AgentConversationEntity, null] })

        await expect(service.lockForHuman("ws-1", "conv-1", inside)).resolves.toBeNull()
    })

    it("persists a handover and captured lead in the primary manager", async () => {
        const { service, em } = await build(mockEntityManager({ update: [AgentConversationEntity, { affected: 1 }] }))

        await service.handToPerson("ws-1", "conv-1", "Lan")
        await service.attachLead("ws-1", "conv-1", "lead-1")

        expect(evaluatedCalls(em.update.mock.calls, 2)).toEqual([
            ["AgentConversationEntity", where, { handledBy: "Lan", handledAt: "now()" }],
            ["AgentConversationEntity", where, { leadId: "lead-1" }],
        ])
    })

    it("updates human handling using the manager that locked the conversation", async () => {
        const { service, em } = await build()
        const inside = mockEntityManager({ update: [AgentConversationEntity, { affected: 1 }] })

        await service.setHumanHandling("ws-1", "conv-1", "Lan", inside)
        await service.setHumanHandling("ws-1", "conv-1", null, inside)

        const customer = { ...where, kind: "customer" }
        expect(evaluatedCalls(inside.update.mock.calls, 2)).toEqual([
            ["AgentConversationEntity", customer, { handledBy: "Lan", handledAt: "now()" }],
            ["AgentConversationEntity", customer, { handledBy: null, handledAt: null }],
        ])
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("AgentConversationsService find and open", () => {
    const input = {
        workspaceId: "ws-1",
        agentId: "agent-1",
        channel: "telegram",
        customerId: "555",
        visitor: "Minh",
        connectionId: "c-1",
    }

    it("answers the conversation of a customer on a connection", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [AgentConversationEntity, telegramConversation()] }),
        )

        await expect(service.find("ws-1", "telegram", "c-1", "555")).resolves.toEqual({
            kind: "ok",
            value: { id: "conv-1", agentId: "agent-1", leadId: null, handledBy: null, visitorName: "Minh" },
        })
        expect(em.findOne).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", channel: "telegram", connectionId: "c-1", externalId: "555" },
                order: { createdAt: "DESC" },
            }),
        )
    })

    it("refuses when the customer never wrote, and reads through the manager it is given", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentConversationEntity, null] }))
        const inside = mockEntityManager({ findOne: [AgentConversationEntity, telegramConversation()] })

        await expect(service.find("ws-1", "telegram", "c-1", "555")).resolves.toMatchObject(REFUSED)
        await expect(service.find("ws-1", "telegram", "c-1", "555", inside)).resolves.toMatchObject({ kind: "ok" })
    })

    it("opens the conversation in the given transaction and answers it", async () => {
        const { service } = await build()
        const inside = mockEntityManager()
        const [fake] = queueQueryBuilders(inside, [{ execute: { raw: [insertedRefRow] } }])

        await expect(service.open(input, inside)).resolves.toMatchObject({ id: "conv-1" })
        expect(fake?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    kind: "customer",
                    channel: "telegram",
                    externalId: "555",
                    visitorName: "Minh",
                    connectionId: "c-1",
                },
            ],
        ])
    })

    it.each([[[]], ["not rows"]])("fails loudly when the insert answers no row (%j)", async (raw) => {
        const { service } = await build()
        const inside = mockEntityManager()
        queueQueryBuilders(inside, [{ execute: { raw } }])

        await expect(service.open(input, inside)).rejects.toMatchObject({
            code: AgentConversationsErrorCode.NotStored,
        })
    })
})

describe("AgentConversationsService writes and targets", () => {
    it("archives, rebinds and renames", async () => {
        const { service, em } = await build(mockEntityManager({ update: [AgentConversationEntity, { affected: 1 }] }))
        const inside = mockEntityManager({ update: [AgentConversationEntity, { affected: 1 }] })

        await service.archive("ws-1", "telegram", "c-1", "555", "555:1", inside)
        await service.rebind("conv-1", "agent-2", inside)
        await service.rename("conv-1", "Minh Tran")

        const where = { workspaceId: "ws-1", channel: "telegram", connectionId: "c-1", externalId: "555" }
        expect(evaluatedCalls(inside.update.mock.calls)).toEqual([
            ["AgentConversationEntity", where, { externalId: "555:1" }],
            ["AgentConversationEntity", { id: "conv-1" }, { agentId: "agent-2" }],
        ])
        expect(evaluatedCalls(em.update.mock.calls)).toEqual([
            ["AgentConversationEntity", { id: "conv-1" }, { visitorName: "Minh Tran" }],
        ])
    })

    it("answers where the replies go, or a refusal for a conversation that does not exist", async () => {
        const found = await build(mockEntityManager({ findOne: [AgentConversationEntity, telegramConversation()] }))
        const missing = await build(mockEntityManager({ findOne: [AgentConversationEntity, null] }))

        await expect(found.service.targetOf("conv-1")).resolves.toEqual({
            kind: "ok",
            value: { id: "conv-1", workspaceId: "ws-1", channel: "telegram", externalId: "555", connectionId: "c-1" },
        })
        await expect(missing.service.targetOf("conv-1")).resolves.toMatchObject(REFUSED)
    })
})

describe("AgentConversationsService turnOf", () => {
    it("answers the conversation with the agent that speaks in it", async () => {
        const em = mockEntityManager({ findOne: [AgentConversationEntity, turnConversation()] })
        const { service } = await build(em)

        await expect(service.turnOf("conv-1")).resolves.toEqual({
            kind: "ok",
            value: {
                id: "conv-1",
                workspaceId: "ws-1",
                channel: "telegram",
                externalId: "555",
                connectionId: "c-1",
                leadId: "lead-1",
                handledBy: "Lan",
                visitorName: "Minh",
                installationId: "inst-1",
                agent: TURN_AGENT,
                speaksAs: null,
            },
        })
    })

    it("speaks under the name of the front agent once a hand-over moved the conversation, and as itself when it is the front agent", async () => {
        const handed = await build(
            mockEntityManager({ findOne: [AgentConversationEntity, { ...turnConversation(), frontAgentId: "front-1" }] }),
        )
        handed.agents.turnFactsOf.mockImplementation((id) =>
            Promise.resolve(id === "front-1" ? { ...TURN_AGENT, id, name: "Chatbot" } : { ...TURN_AGENT, name: "Sales AI" }),
        )
        const own = await build(
            mockEntityManager({ findOne: [AgentConversationEntity, { ...turnConversation(), frontAgentId: "agent-1" }] }),
        )

        await expect(handed.service.turnOf("conv-1")).resolves.toMatchObject({
            value: { speaksAs: "Chatbot", agent: { name: "Sales AI" } },
        })
        await expect(own.service.turnOf("conv-1")).resolves.toMatchObject({ value: { speaksAs: null } })
        expect(own.agents.turnFactsOf).toHaveBeenCalledTimes(1)
    })

    it("refuses a conversation that does not exist and one whose agent is gone", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentConversationEntity, null] }))
        const orphaned = await build(mockEntityManager({ findOne: [AgentConversationEntity, turnConversation()] }))
        orphaned.agents.turnFactsOf.mockResolvedValue(null)

        await expect(service.turnOf("conv-1")).resolves.toMatchObject(REFUSED)
        await expect(orphaned.service.turnOf("conv-1")).resolves.toMatchObject(REFUSED)
    })
})

describe("AgentConversationsService test chats", () => {
    it("tells an owner's test chat from a customer's conversation and a missing one", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentConversationEntity, testConversation()] }))
        await expect(service.isTestChat("conv-1")).resolves.toBe(true)
        const customer = await build(mockEntityManager({ findOne: [AgentConversationEntity, telegramConversation()] }))
        await expect(customer.service.isTestChat("conv-1")).resolves.toBe(false)
        const missing = await build(mockEntityManager({ findOne: [AgentConversationEntity, null] }))
        await expect(missing.service.isTestChat("conv-9")).resolves.toBe(false)
        expect(missing.em.findOne).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({ where: { id: "conv-9" } }),
        )
    })
})

describe("AgentConversationsService connector party", () => {
    it("answers the party a conversation remembers, with an empty name when the connector gave none", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [AgentConversationEntity, namedPartyConversation()] }),
        )
        await expect(service.partyOf("ws-1", "conv-1")).resolves.toEqual({ partyId: "p1", name: "Lan" })
        expect(em.findOne).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", id: "conv-1", connectorPartyId: Not(IsNull()) } }),
        )
        const unnamed = await build(
            mockEntityManager({ findOne: [AgentConversationEntity, unnamedPartyConversation()] }),
        )
        await expect(unnamed.service.partyOf("ws-1", "conv-1")).resolves.toEqual({ partyId: "p2", name: "" })
    })

    it("answers null while the conversation remembers no party", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentConversationEntity, null] }))
        await expect(service.partyOf("ws-1", "conv-1")).resolves.toBeNull()
    })

    it("remembers the party the connector answered", async () => {
        const { service, em } = await build(mockEntityManager({ update: [AgentConversationEntity, { affected: 1 }] }))
        const party = { partyId: "p1", name: "Lan" }

        await service.rememberParty({ workspaceId: "ws-1", conversationId: "conv-1", party })

        expect(evaluatedCalls(em.update.mock.calls, 2)).toEqual([
            [
                "AgentConversationEntity",
                { workspaceId: "ws-1", id: "conv-1" },
                { connectorPartyId: "p1", connectorPartyName: "Lan", connectorPartyAt: "now()" },
            ],
        ])
    })
})

describe("AgentConversationsService installationIdOf", () => {
    it("answers the installation a row of the workspace names", async () => {
        const em = mockEntityManager({
            findOne: [
                AgentConversationEntity,
                Object.assign(new AgentConversationEntity(), { installationId: "inst-1" }),
            ],
        })

        await expect((await build(em)).service.installationIdOf("ws-1", "rec-1")).resolves.toBe("inst-1")
        expect(em.findOne).toHaveBeenCalledWith(AgentConversationEntity, {
            select: { installationId: true },
            where: { workspaceId: "ws-1", id: "rec-1" },
        })
    })

    it("answers null for a missing row and for a row that names no installation", async () => {
        const em = mockEntityManager({ findOne: [AgentConversationEntity, null] })
        await expect((await build(em)).service.installationIdOf("ws-1", "rec-1")).resolves.toBeNull()

        const bare = mockEntityManager({
            findOne: [AgentConversationEntity, Object.assign(new AgentConversationEntity(), { installationId: null })],
        })
        await expect((await build(bare)).service.installationIdOf("ws-1", "rec-1")).resolves.toBeNull()
    })
})
