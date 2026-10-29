import { Test } from "@nestjs/testing"
import {
    sentReplyInC1,
    sentReplyOf,
    sentReplyR1,
    untriedTurnMessage,
} from "@tests/fixtures/builders/agent-messages.builder"
import { In } from "typeorm"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentMessageDeliveriesService } from "./agent-message-deliveries.service"
import { AgentMessageEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentMessageDeliveriesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentMessageDeliveriesService)
}

describe("AgentMessageDeliveriesService > humanReplyOf", () => {
    it("answers the delivery of the human reply", async () => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, sentReplyOf()] })

        await expect((await build(em)).humanReplyOf("ws", "c1", "m1")).resolves.toEqual({
            id: "m1",
            deliveryStatus: "sent",
        })
        expect(em.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, deliveryStatus: true },
            where: { workspaceId: "ws", conversationId: "c1", id: "m1", authorKind: "human" },
        })
    })

    it("answers null when the conversation holds no such reply", async () => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, null] })

        await expect((await build(em)).humanReplyOf("ws", "c1", "m9")).resolves.toBeNull()
    })
})

describe("AgentMessageDeliveriesService > humanReplyById", () => {
    it("answers the human reply of the workspace with its conversation", async () => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, sentReplyInC1()] })

        await expect((await build(em)).humanReplyById("ws", "m1")).resolves.toEqual({
            id: "m1",
            conversationId: "c1",
            deliveryStatus: "sent",
        })
        expect(em.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, conversationId: true, deliveryStatus: true },
            where: { workspaceId: "ws", id: "m1", authorKind: "human" },
        })
    })

    it("answers null when the workspace has no such human reply", async () => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, null] })

        await expect((await build(em)).humanReplyById("ws", "m9")).resolves.toBeNull()
    })
})

describe("AgentMessageDeliveriesService > turn messages", () => {
    it("answers the customer or agent message of the workspace with its conversation", async () => {
        const em = mockEntityManager({
            findOne: [AgentMessageEntity, untriedTurnMessage()],
        })

        await expect((await build(em)).turnMessageOf("ws", "m1")).resolves.toEqual({
            id: "m1",
            conversationId: "c1",
            role: "user",
            deliveryStatus: null,
        })
        expect(em.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, conversationId: true, role: true, deliveryStatus: true },
            where: { workspaceId: "ws", id: "m1", role: In(["user", "agent"]) },
        })
    })

    it("answers null when the workspace has no such message", async () => {
        const em = mockEntityManager({ findOne: [AgentMessageEntity, null] })

        await expect((await build(em)).turnMessageOf("ws", "m9")).resolves.toBeNull()
    })

    it("answers the agent reply stored for a message, null for none", async () => {
        const found = mockEntityManager({ findOne: [AgentMessageEntity, sentReplyR1()] })
        const missing = mockEntityManager({ findOne: [AgentMessageEntity, null] })

        await expect((await build(found)).agentReplyTo("ws", "c1", "m1")).resolves.toEqual({
            id: "r1",
            deliveryStatus: "sent",
        })
        await expect((await build(missing)).agentReplyTo("ws", "c1", "m9")).resolves.toBeNull()
        expect(found.findOne).toHaveBeenCalledWith(AgentMessageEntity, {
            select: { id: true, deliveryStatus: true },
            where: { workspaceId: "ws", conversationId: "c1", inReplyTo: "m1", role: "agent" },
        })
    })
})
