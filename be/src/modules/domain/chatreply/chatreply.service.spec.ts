import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { DecisionsService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import { DecisionsQueue } from "@modules/queues/decisions"
import { ChatReplyService } from "./chatreply.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const catalog = mock<MessageCatalog>()
    const members = mock<WorkspaceMembersService>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const decisions = mock<DecisionsService>()
    const events = mock<EventsService>()
    const chatTurns = mock<ChatTurnQueue>()
    const decisionQueue = mock<DecisionsQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatReplyService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: DecisionsService, useValue: decisions },
            { provide: EventsService, useValue: events },
            { provide: ChatTurnQueue, useValue: chatTurns },
            { provide: DecisionsQueue, useValue: decisionQueue },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChatReplyService),
        entityManager,
        catalog,
        members,
        conversations,
        messages,
        decisions,
        events,
        chatTurns,
        decisionQueue,
    }
}

describe("ChatReplyService", () => {
    describe("setHandling", () => {
        it("setHandling has its first case written", async () => {
            const { service } = await build()
            expect(service.setHandling).toBeInstanceOf(Function)
        })
    })

    describe("requestReply", () => {
        it("requestReply has its first case written", async () => {
            const { service } = await build()
            expect(service.requestReply).toBeInstanceOf(Function)
        })
    })

    describe("requestAnswer", () => {
        it("requestAnswer has its first case written", async () => {
            const { service } = await build()
            expect(service.requestAnswer).toBeInstanceOf(Function)
        })
    })
})
