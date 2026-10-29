import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { AgentConversationsReadService } from "./agent-conversations-read.service"
import { AgentConversationEntity } from "./persistence/entities"

const chatOf = entityOf(AgentConversationEntity, { id: "c-1", agentId: "a-1", kind: "customer", leadId: null })

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentConversationsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentConversationsReadService)
}

describe("AgentConversationsReadService", () => {
    it("asks for nothing when no agent is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).testChatsOf("ws-1", [], 10)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })

    it("lists the test chats of the given agents in id order, bounded", async () => {
        const em = mockEntityManager({
            find: [AgentConversationEntity, [chatOf({ kind: "test" })]],
        })

        await expect((await build(em)).testChatsOf("ws-1", ["a-1"], 10)).resolves.toEqual([
            { id: "c-1", agentId: "a-1" },
        ])
        expect(em.find).toHaveBeenCalledWith(AgentConversationEntity, {
            select: { id: true, agentId: true },
            where: { workspaceId: "ws-1", kind: "test", agentId: In(["a-1"]) },
            order: { id: "ASC" },
            take: 10,
        })
    })

    it("asks whether the workspace has a customer conversation or a captured customer", async () => {
        const em = mockEntityManager({ exists: [AgentConversationEntity, true] })
        const service = await build(em)

        await expect(service.hasCustomerChat("ws-1")).resolves.toBe(true)
        await expect(service.hasLeadChat("ws-1")).resolves.toBe(true)
        expect(em.exists).toHaveBeenNthCalledWith(1, AgentConversationEntity, {
            where: { workspaceId: "ws-1", kind: "customer" },
        })
        expect(em.exists).toHaveBeenNthCalledWith(2, AgentConversationEntity, {
            where: { workspaceId: "ws-1", leadId: Not(IsNull()) },
        })
    })

    it("finds a customer conversation by id inside the given manager, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentConversationEntity, chatOf({ id: "c-1", leadId: "l-1" })],
                [AgentConversationEntity, null],
            ],
        })
        const service = await build(mockEntityManager())

        await expect(service.customerChat("ws-1", "c-1", em)).resolves.toEqual({ id: "c-1", leadId: "l-1" })
        await expect(service.customerChat("ws-1", "c-9", em)).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(AgentConversationEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId: "ws-1", kind: "customer", id: "c-1" },
        })
    })

    it("finds the latest customer conversation of a customer, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentConversationEntity, chatOf({ id: "c-2", leadId: "l-1" })],
                [AgentConversationEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.latestCustomerChatOfLead("ws-1", "l-1")).resolves.toEqual({ id: "c-2", leadId: "l-1" })
        await expect(service.latestCustomerChatOfLead("ws-1", "l-9")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(AgentConversationEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId: "ws-1", kind: "customer", leadId: "l-1" },
            order: { createdAt: "DESC" },
        })
    })
})

describe("AgentConversationsReadService > channelOf", () => {
    it("answers the channel of the conversation, null for none", async () => {
        const found = mockEntityManager({ findOne: [AgentConversationEntity, chatOf({ channel: "zalo" })] })
        const missing = mockEntityManager({ findOne: [AgentConversationEntity, null] })

        await expect((await build(found)).channelOf("c1")).resolves.toBe("zalo")
        await expect((await build(missing)).channelOf("c9")).resolves.toBeNull()
        expect(found.findOne).toHaveBeenCalledWith(AgentConversationEntity, {
            select: { id: true, channel: true },
            where: { id: "c1" },
        })
    })
})
