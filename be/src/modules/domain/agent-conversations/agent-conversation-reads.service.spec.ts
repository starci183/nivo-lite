import { builder, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentConversationReadService } from "./agent-conversation-reads.service"
import { AgentConversationEntity } from "./persistence/entities"

const CREATED = new Date("2026-10-13T02:00:00.000Z")

const ROW = builder<AgentConversationEntity>({
    id: "chat-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    kind: "customer",
    visitorName: null,
    leadId: "lead-1",
    createdAt: CREATED,
    handledBy: null,
    handledAt: null,
    channel: "zalo",
    externalId: "zalo-9",
    connectionId: null,
    installationId: null,
    connectorPartyId: null,
    connectorPartyName: null,
    connectorPartyAt: null,
})()
const VIEW = {
    id: "chat-1",
    leadId: "lead-1",
    channel: "zalo",
    externalId: "zalo-9",
    handledBy: null,
    createdAt: CREATED,
}

const build = async (rows: ReadonlyArray<AgentConversationEntity>) => {
    const em = mockEntityManager({ find: [AgentConversationEntity, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentConversationReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(AgentConversationReadService), em }
}

describe("AgentConversationReadService", () => {
    it("reads the customer chats named by conversation id or by lead, newest first", async () => {
        const { service, em } = await build([ROW])

        await expect(
            service.customerChatsOf("ws-1", { conversationIds: ["chat-1"], leadIds: ["lead-2"] }),
        ).resolves.toEqual([VIEW])

        expect(em.find).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({
                where: [
                    { workspaceId: "ws-1", kind: "customer", id: In(["chat-1"]) },
                    { workspaceId: "ws-1", kind: "customer", leadId: In(["lead-2"]) },
                ],
                order: { createdAt: "DESC", id: "DESC" },
            }),
        )
    })

    it("reads only the named side and nothing for an empty reference", async () => {
        const { service, em } = await build([ROW])
        const other = mockEntityManager({ find: [AgentConversationEntity, []] })

        await service.customerChatsOf("ws-1", { conversationIds: [], leadIds: ["lead-1"] }, other)
        await expect(service.customerChatsOf("ws-1", { conversationIds: [], leadIds: [] })).resolves.toEqual([])

        expect(other.find).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({ where: [{ workspaceId: "ws-1", kind: "customer", leadId: In(["lead-1"]) }] }),
        )
        expect(em.find).not.toHaveBeenCalled()
    })
})
