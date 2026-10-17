import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import { DecisionsQueue } from "@modules/queues/decisions"
import { ChatReplyService } from "./chatreply.service"
import { ChatreplyErrorCode } from "./errors/chatreply.error"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "staff-1",
    displayName: "An",
    status: "active",
}

const CONVERSATION = {
    id: "conversation-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "customer-1",
    connectionId: "connection-1",
    leadId: "lead-1",
    handledBy: "An",
}

const itemOf = builder<WorkItem>({
    id: "work-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "reply_customer",
    subject_type: "conversation",
    subject_id: "conversation-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Reply", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: "staff-1",
    execution_id: null,
    origin: "live",
    created_at: "2026-10-14T00:00:00.000Z",
    updated_at: "2026-10-14T00:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const entityManager = mockEntityManager()
    const transaction = fakeTransaction(entityManager)
    const catalog = mock<MessageCatalog>()
    const members = mock<WorkspaceMembersService>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const decisions = mock<DecisionsService>()
    const events = mock<EventsService>()
    const chatTurns = mock<ChatTurnQueue>()
    const decisionQueue = mock<DecisionsQueue>()
    members.require.mockResolvedValue(MEMBER)
    conversations.lockForHuman.mockResolvedValue(CONVERSATION)
    messages.storeHumanMessage.mockResolvedValue("message-1")
    catalog.get.mockReturnValue("Audit summary")
    decisions.getWorkItem.mockResolvedValue(itemOf())
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
        transaction,
    }
}

describe("ChatReplyService", () => {
    describe("setHandling", () => {
        it("setHandling exercises its first behavior through the compiled module", async () => {
            const { service, conversations, messages, events, transaction } = await build()
            conversations.lockForHuman.mockResolvedValue(null)

            await expect(service.setHandling("user-1", "ws-1", "conversation-1", true, "en")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(transaction.outcomes).toEqual(["rollback"])
            expect(conversations.setHumanHandling).not.toHaveBeenCalled()
            expect(messages.storeLine).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()

            expect(service.setHandling).toBeInstanceOf(Function)
        })
    })
})

describe("ChatReplyService", () => {
    describe("setHandling", () => {
        it("refuses a missing conversation inside the transaction", async () => {
            const { service, conversations, messages, events, transaction } = await build()
            conversations.lockForHuman.mockResolvedValue(null)

            await expect(service.setHandling("user-1", "ws-1", "conversation-1", true, "en")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(transaction.outcomes).toEqual(["rollback"])
            expect(conversations.setHumanHandling).not.toHaveBeenCalled()
            expect(messages.storeLine).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
        })
    })
})

describe("ChatReplyService", () => {
    describe("setHandling", () => {
        it("refuses staff changing a conversation held by another person", async () => {
            const { service, conversations, messages, events, transaction } = await build()
            conversations.lockForHuman.mockResolvedValue({ ...CONVERSATION, handledBy: "Other" })

            await expect(service.setHandling("user-1", "ws-1", "conversation-1", true, "en")).rejects.toMatchObject({
                code: ChatreplyErrorCode.HeldByOther,
            })
            expect(conversations.setHumanHandling).not.toHaveBeenCalled()
            expect(messages.storeLine).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["rollback"])
        })
    })
})

describe("ChatReplyService", () => {
    describe("setHandling", () => {
        it.each([
            [true, "An"],
            [false, null],
        ] as const)("keeps handling unchanged when takeOver is %s", async (takeOver, handledBy) => {
            const { service, conversations, messages, events, catalog, transaction } = await build()
            conversations.lockForHuman.mockResolvedValue({ ...CONVERSATION, handledBy })

            await expect(service.setHandling("user-1", "ws-1", "conversation-1", takeOver, "en")).resolves.toEqual({
                conversationId: "conversation-1",
                handledBy,
            })
            expect(conversations.setHumanHandling).not.toHaveBeenCalled()
            expect(messages.storeLine).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
            expect(catalog.get).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["commit"])
        })
    })
})

describe("ChatReplyService", () => {
    describe("setHandling", () => {
        it.each([
            [true, null, "An", "chatreply.takenOver", "conversation.take_over"],
            [false, "An", null, "chatreply.released", "conversation.hand_back"],
        ] as const)(
            "changes handling and writes its audit when takeOver is %s",
            async (takeOver, previous, handledBy, messageKey, kind) => {
                const { service, conversations, messages, events, members, catalog, transaction } = await build()
                conversations.lockForHuman.mockResolvedValue({ ...CONVERSATION, handledBy: previous })

                await expect(service.setHandling("user-1", "ws-1", "conversation-1", takeOver, "en")).resolves.toEqual({
                    conversationId: "conversation-1",
                    handledBy,
                })
                const manager = conversations.lockForHuman.mock.calls[0]?.[2]
                expect(isTransactionManager(manager)).toBe(true)
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(conversations.lockForHuman).toHaveBeenCalledWith("ws-1", "conversation-1", manager)
                expect(conversations.setHumanHandling).toHaveBeenCalledWith(
                    "ws-1",
                    "conversation-1",
                    handledBy,
                    manager,
                )
                expect(catalog.get).toHaveBeenCalledWith(messageKey, { name: "An" }, "en")
                expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conversation-1", "Audit summary", manager)
                expect(events.record).toHaveBeenCalledWith(
                    { workspaceId: "ws-1", leadId: "lead-1", kind, actor: "An", summary: "Audit summary" },
                    manager,
                )
                expect(transaction.outcomes).toEqual(["commit"])
            },
        )
    })
})

describe("ChatReplyService", () => {
    describe("requestReply", () => {
        const request = { conversationId: "conversation-1", body: "  Hello customer \n", locale: "en" } as const
        it("requestReply exercises its first behavior through the compiled module", async () => {
            const { service, conversations, messages, chatTurns, transaction } = await build()
            conversations.lockForHuman.mockResolvedValue(null)

            await expect(service.requestReply("user-1", "ws-1", request)).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(messages.storeHumanMessage).not.toHaveBeenCalled()
            expect(chatTurns.enqueueChatTurn).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["rollback"])

            expect(service.requestReply).toBeInstanceOf(Function)
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestReply", () => {
        const request = { conversationId: "conversation-1", body: "  Hello customer \n", locale: "en" } as const
        it("refuses a missing conversation before storing or enqueueing a reply", async () => {
            const { service, conversations, messages, chatTurns, transaction } = await build()
            conversations.lockForHuman.mockResolvedValue(null)

            await expect(service.requestReply("user-1", "ws-1", request)).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(messages.storeHumanMessage).not.toHaveBeenCalled()
            expect(chatTurns.enqueueChatTurn).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["rollback"])
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestReply", () => {
        const request = { conversationId: "conversation-1", body: "  Hello customer \n", locale: "en" } as const
        it.each([null, "OpenClaw"])("requires a person to hold the conversation instead of %s", async (handledBy) => {
            const { service, conversations, messages, chatTurns } = await build()
            conversations.lockForHuman.mockResolvedValue({ ...CONVERSATION, handledBy })

            await expect(service.requestReply("user-1", "ws-1", request)).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotHeld,
            })
            expect(messages.storeHumanMessage).not.toHaveBeenCalled()
            expect(chatTurns.enqueueChatTurn).not.toHaveBeenCalled()
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestReply", () => {
        const request = { conversationId: "conversation-1", body: "  Hello customer \n", locale: "en" } as const
        it("refuses a staff reply in a conversation held by another person", async () => {
            const { service, conversations, messages, chatTurns, events } = await build()
            conversations.lockForHuman.mockResolvedValue({ ...CONVERSATION, handledBy: "Other" })

            await expect(service.requestReply("user-1", "ws-1", request)).rejects.toMatchObject({
                code: ChatreplyErrorCode.HeldByOther,
            })
            expect(messages.storeHumanMessage).not.toHaveBeenCalled()
            expect(chatTurns.enqueueChatTurn).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestReply", () => {
        const request = { conversationId: "conversation-1", body: "  Hello customer \n", locale: "en" } as const
        it("stores the trimmed human message and its delivery job in the same transaction", async () => {
            const { service, members, conversations, messages, chatTurns, events, catalog, transaction } = await build()

            await expect(service.requestReply("user-1", "ws-1", request)).resolves.toEqual({
                id: "message-1",
                status: "queued",
                messageId: "message-1",
                delivery: null,
                errorCode: null,
            })
            const manager = conversations.lockForHuman.mock.calls[0]?.[2]
            expect(isTransactionManager(manager)).toBe(true)
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(conversations.lockForHuman).toHaveBeenCalledWith("ws-1", "conversation-1", manager)
            expect(messages.storeHumanMessage).toHaveBeenCalledWith(
                "ws-1",
                "conversation-1",
                "Hello customer",
                "An",
                manager,
            )
            expect(chatTurns.enqueueChatTurn).toHaveBeenCalledWith(
                {
                    kind: "deliver",
                    workspaceId: "ws-1",
                    conversationId: "conversation-1",
                    messageId: "message-1",
                    channelEventId: "human:message-1",
                    lookupName: false,
                },
                manager,
            )
            expect(catalog.get).toHaveBeenCalledWith("chatreply.replyQueued", { name: "An" }, "en")
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    kind: "conversation.human_reply",
                    actor: "An",
                    summary: "Audit summary",
                    evidence: "Hello customer",
                },
                manager,
            )
            expect(transaction.outcomes).toEqual(["commit"])
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestAnswer", () => {
        const request = {
            workItemId: "work-1",
            conversationId: "conversation-1",
            text: " Reply ",
            locale: "en",
        } as const
        it("requestAnswer exercises its first behavior through the compiled module", async () => {
            const { service, decisions, decisionQueue } = await build()
            decisions.getWorkItem.mockResolvedValue(itemOf({ status: "done" }))

            await expect(service.requestAnswer("user-1", "ws-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.NotWaiting,
            })
            expect(decisionQueue.enqueueDecideWork).not.toHaveBeenCalled()

            expect(service.requestAnswer).toBeInstanceOf(Function)
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestAnswer", () => {
        const request = {
            workItemId: "work-1",
            conversationId: "conversation-1",
            text: " Reply ",
            locale: "en",
        } as const
        it.each([{ action: "other_action" }, { subject_id: "other-conversation" }])(
            "rejects an item that does not address this answer: %j",
            async (changes) => {
                const { service, decisions, entityManager, decisionQueue } = await build()
                decisions.getWorkItem.mockResolvedValue(itemOf(changes))

                await expect(service.requestAnswer("user-1", "ws-1", request)).rejects.toMatchObject({
                    code: ChatreplyErrorCode.AnswerMismatch,
                })
                expect(decisions.getWorkItem).toHaveBeenCalledWith("user-1", "ws-1", "work-1")
                expect(entityManager.transaction).not.toHaveBeenCalled()
                expect(decisionQueue.enqueueDecideWork).not.toHaveBeenCalled()
            },
        )
    })
})

describe("ChatReplyService", () => {
    describe("requestAnswer", () => {
        const request = {
            workItemId: "work-1",
            conversationId: "conversation-1",
            text: " Reply ",
            locale: "en",
        } as const
        it("rejects an answer that is no longer waiting for a decision", async () => {
            const { service, decisions, decisionQueue } = await build()
            decisions.getWorkItem.mockResolvedValue(itemOf({ status: "done" }))

            await expect(service.requestAnswer("user-1", "ws-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.NotWaiting,
            })
            expect(decisionQueue.enqueueDecideWork).not.toHaveBeenCalled()
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestAnswer", () => {
        const request = {
            workItemId: "work-1",
            conversationId: "conversation-1",
            text: " Reply ",
            locale: "en",
        } as const
        it("refuses a staff member for an unassigned answer", async () => {
            const { service, decisions, entityManager, decisionQueue } = await build()
            decisions.getWorkItem.mockResolvedValue(itemOf({ assigned_staff_id: null }))

            await expect(service.requestAnswer("user-1", "ws-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.NotAllowed,
            })
            expect(entityManager.transaction).not.toHaveBeenCalled()
            expect(decisionQueue.enqueueDecideWork).not.toHaveBeenCalled()
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestAnswer", () => {
        const request = {
            workItemId: "work-1",
            conversationId: "conversation-1",
            text: " Reply ",
            locale: "en",
        } as const
        it("refuses an answer when its conversation vanished before enqueueing", async () => {
            const { service, conversations, decisionQueue, transaction } = await build()
            conversations.lockForHuman.mockResolvedValue(null)

            await expect(service.requestAnswer("user-1", "ws-1", request)).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(decisionQueue.enqueueDecideWork).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["rollback"])
        })
    })
})

describe("ChatReplyService", () => {
    describe("requestAnswer", () => {
        const request = {
            workItemId: "work-1",
            conversationId: "conversation-1",
            text: " Reply ",
            locale: "en",
        } as const
        it.each([
            [" Reply ", "approved", { draft: "Reply", fields: [{ name: "conversation_id", text: "conversation-1" }] }],
            [null, "rejected", null],
        ] as const)("queues text %s as %s with precise edits", async (text, decision, edits) => {
            const { service, members, decisions, conversations, decisionQueue, transaction } = await build()

            await expect(service.requestAnswer("user-1", "ws-1", { ...request, text })).resolves.toEqual({
                id: "work-1",
                status: "queued",
                messageId: null,
                delivery: null,
                errorCode: null,
            })
            const manager = conversations.lockForHuman.mock.calls[0]?.[2]
            expect(isTransactionManager(manager)).toBe(true)
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(decisions.getWorkItem).toHaveBeenCalledWith("user-1", "ws-1", "work-1")
            expect(conversations.lockForHuman).toHaveBeenCalledWith("ws-1", "conversation-1", manager)
            expect(decisionQueue.enqueueDecideWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", userId: "user-1", workItemId: "work-1", locale: "en", decision, edits },
                manager,
            )
            expect(transaction.outcomes).toEqual(["commit"])
        })
    })
})
