import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { DecisionsError, DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService, canDecide } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import { DecisionsQueue } from "@modules/queues/decisions"
import type { ChatAnswerRequest, ChatHandlingResult, ChatReplyProgress, ChatReplyRequest } from "./chatreply.contracts"
import { answerConversationId, requireHandlingAccess, replyBody } from "./chatreply.policy"
import { ChatreplyError, ChatreplyErrorCode } from "./errors/chatreply.error"

const accepted = (id: string): ChatReplyProgress => ({
    id,
    status: "queued",
    messageId: null,
    delivery: null,
    errorCode: null,
})

@Injectable()
/** Proves member access, stores human replies through their table owner, and enqueues existing fenced jobs. */
export class ChatReplyService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly decisions: DecisionsService,
        private readonly events: EventsService,
        private readonly chatTurns: ChatTurnQueue,
        private readonly decisionQueue: DecisionsQueue,
    ) {}

    /** Takes over or releases a customer conversation and writes the visible audit line in the same transaction. */
    async setHandling(
        principalId: string,
        workspaceId: string,
        conversationId: string,
        takeOver: boolean,
        locale: Locale,
    ): Promise<ChatHandlingResult> {
        const member = await this.members.require(principalId, workspaceId)
        return this.entityManager.transaction(async (manager) => {
            const conversation = await this.conversations.lockForHuman(workspaceId, conversationId, manager)
            if (conversation === null) throw new ChatreplyError({ code: ChatreplyErrorCode.NotFound })
            requireHandlingAccess(member, conversation.handledBy)
            const handledBy = takeOver ? member.displayName : null
            if (conversation.handledBy === handledBy) return { conversationId, handledBy }
            await this.conversations.setHumanHandling(workspaceId, conversationId, handledBy, manager)
            const summary = this.catalog.get(
                takeOver ? "chatreply.takenOver" : "chatreply.released",
                { name: member.displayName },
                locale,
            )
            await this.messages.storeLine(workspaceId, conversationId, summary, manager)
            await this.events.record(
                {
                    workspaceId,
                    leadId: conversation.leadId,
                    kind: takeOver ? "conversation.take_over" : "conversation.hand_back",
                    actor: member.displayName,
                    summary,
                },
                manager,
            )
            return { conversationId, handledBy }
        })
    }

    /** Stores the member's reply and its delivery job atomically; no provider is called by this request. */
    async requestReply(
        principalId: string,
        workspaceId: string,
        request: ChatReplyRequest,
    ): Promise<ChatReplyProgress> {
        const member = await this.members.require(principalId, workspaceId)
        const body = replyBody(request.body)
        return this.entityManager.transaction(async (manager) => {
            const conversation = await this.conversations.lockForHuman(workspaceId, request.conversationId, manager)
            if (conversation === null) throw new ChatreplyError({ code: ChatreplyErrorCode.NotFound })
            if (conversation.handledBy === null || conversation.handledBy === "OpenClaw")
                throw new ChatreplyError({ code: ChatreplyErrorCode.NotHeld })
            requireHandlingAccess(member, conversation.handledBy)
            const messageId = await this.messages.storeHumanMessage(
                workspaceId,
                conversation.id,
                body,
                member.displayName,
                manager,
                null,
                member.userId,
            )
            await this.chatTurns.enqueueChatTurn(
                {
                    kind: "deliver",
                    workspaceId,
                    conversationId: conversation.id,
                    messageId,
                    channelEventId: `human:${messageId}`,
                    lookupName: false,
                },
                manager,
            )
            await this.events.record(
                {
                    workspaceId,
                    leadId: conversation.leadId,
                    kind: "conversation.human_reply",
                    actor: member.displayName,
                    summary: this.catalog.get("chatreply.replyQueued", { name: member.displayName }, request.locale),
                    evidence: body,
                },
                manager,
            )
            return { ...accepted(messageId), messageId }
        })
    }

    /** Queues an escalation decision after proving the caller may decide this precise conversation's reply item. */
    async requestAnswer(
        principalId: string,
        workspaceId: string,
        request: ChatAnswerRequest,
    ): Promise<ChatReplyProgress> {
        const member = await this.members.require(principalId, workspaceId)
        const item = await this.decisions.getWorkItem(principalId, workspaceId, request.workItemId)
        if (item.action !== "reply_customer" || answerConversationId(item) !== request.conversationId) {
            throw new ChatreplyError({ code: ChatreplyErrorCode.AnswerMismatch })
        }
        if (item.status !== "waiting_decision") throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        if (
            !canDecide(member, {
                assigneeKind: item.assigned_staff_id === null ? null : "staff",
                assigneeId: item.assigned_staff_id,
            })
        ) {
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        }
        const text = request.text === null ? null : replyBody(request.text)
        await this.entityManager.transaction(async (manager) => {
            const conversation = await this.conversations.lockForHuman(workspaceId, request.conversationId, manager)
            if (conversation === null) throw new ChatreplyError({ code: ChatreplyErrorCode.NotFound })
            await this.decisionQueue.enqueueDecideWork(
                {
                    workspaceId,
                    userId: principalId,
                    workItemId: item.id,
                    locale: request.locale,
                    decision: text === null ? "rejected" : "approved",
                    edits:
                        text === null
                            ? null
                            : { draft: text, fields: [{ name: "conversation_id", text: request.conversationId }] },
                },
                manager,
            )
        })
        return accepted(item.id)
    }
}
