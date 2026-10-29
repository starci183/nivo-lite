import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationEntity, AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessageEntity, AgentMessagesService } from "@modules/domain/agent-messages"
import { AgentEntity, AgentsService } from "@modules/domain/agents"
import { EventsReadService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueStatusService } from "@modules/platform/queue"
import type { QueueStatusService } from "@modules/platform/queue"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import type {
    AgentChatAgentRequest,
    AgentChatConversationRequest,
    AgentChatConversations,
    AgentChatHolder,
    AgentChatMessages,
    AgentChatPageData,
    AgentChatPageRequest,
    AgentChatTurnStatus,
    AgentChatTurnStatusRequest,
    ChatAgentFacts,
    ChatTurnFacts,
    QueuedAgentChatTurn,
    SendAgentChatRequest,
    StartAgentChatRequest,
    TakeOverAgentChatRequest,
} from "./agent-chat.contracts"
import { AGENT_CHAT_FOUNDING_OFFER } from "./agent-chat.templates"
import { AgentChatError, AgentChatErrorCode } from "./errors/agent-chat.error"

const BODY_MAX = 4000
const VISITOR_MAX = 80
const LINE_MAX = 400

@Injectable()
/** Agent chat orchestration: proves membership and delegates every table write to its existing capability owner. */
export class AgentChatService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly agents: AgentsService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly events: EventsReadService,
        private readonly turns: ChatTurnQueue,
        @InjectQueueStatusService() private readonly queueStatus: QueueStatusService,
    ) {}

    /** The agent page metadata, including the conditional campaign welcome. */
    async page(userId: string, request: AgentChatPageRequest): Promise<AgentChatPageData> {
        await this.members.require(userId, request.workspaceId)
        const [meta, profile] = await Promise.all([
            this.requireAgent(request),
            this.agents.profileOf(request.workspaceId, request.agentId),
        ])
        if (profile === null) throw new AgentChatError({ code: AgentChatErrorCode.AgentNotFound })
        return {
            id: profile.id,
            module: meta.module,
            name: profile.name,
            handle: profile.handle,
            role: profile.role,
            isActive: meta.status === "active",
            hasCustomerChannel: meta.module === "chatbot",
            workspaceId: request.workspaceId,
            showWelcome:
                request.welcome && meta.module === "chatbot" && (await this.isFoundingMember(request.workspaceId)),
        }
    }

    /** The agent's bounded history in the selected workspace. */
    async listConversations(userId: string, request: AgentChatAgentRequest): Promise<AgentChatConversations> {
        await this.members.require(userId, request.workspaceId)
        await this.requireAgent(request)
        return this.conversations.listChat(request.workspaceId, request.agentId)
    }

    /** The bounded thread, after proving both membership and conversation scope. */
    async listMessages(userId: string, request: AgentChatConversationRequest): Promise<AgentChatMessages> {
        await this.members.require(userId, request.workspaceId)
        await this.requireConversation(request)
        return this.messages.listChat(request.workspaceId, request.conversationId)
    }

    /** Opens a conversation and stores its greeting in the same transaction. */
    async start(userId: string, request: StartAgentChatRequest): Promise<string> {
        const member = await this.members.require(userId, request.workspaceId)
        const agent = await this.requireAgent(request)
        const visitorName =
            request.visitorName?.trim().slice(0, VISITOR_MAX) || (request.kind === "test" ? member.displayName : null)
        return this.entityManager.transaction(async (manager) => {
            const conversation = await this.conversations.openChat({ ...request, visitorName }, manager)
            if (agent.greeting !== "")
                await this.messages.storeGreeting(request.workspaceId, conversation.id, agent.greeting, manager)
            return conversation.id
        })
    }

    /** Stores a submission and enqueues the existing chat-turn job atomically; the mutation never waits for the engine or provider. */
    async send(userId: string, request: SendAgentChatRequest): Promise<QueuedAgentChatTurn> {
        const member = await this.members.require(userId, request.workspaceId)
        const body = request.body.trim()
        if (body === "" || body.length > BODY_MAX) throw new AgentChatError({ code: AgentChatErrorCode.InvalidBody })
        return this.entityManager.transaction(async (manager) => {
            const conversation = await this.conversations.lockChat(request.workspaceId, request.conversationId, manager)
            const kind = conversation.kind === "customer" && conversation.handledBy !== null ? "deliver" : "turn"
            const id =
                kind === "deliver"
                    ? await this.messages.storeHuman(
                          request.workspaceId,
                          conversation.id,
                          body,
                          member.displayName,
                          manager,
                          member.userId,
                      )
                    : await this.messages.storeCustomer(
                          request.workspaceId,
                          conversation.id,
                          body,
                          manager,
                          member.userId,
                      )
            await this.turns.enqueueChatTurn(
                {
                    kind,
                    workspaceId: request.workspaceId,
                    conversationId: conversation.id,
                    messageId: id,
                    channelEventId: `agentchat:${id}`,
                    lookupName: false,
                },
                manager,
            )
            return { id, conversationId: conversation.id, status: "queued" }
        })
    }

    /** Records a person's takeover or return and the associated system line together. */
    async takeOver(userId: string, request: TakeOverAgentChatRequest): Promise<AgentChatHolder> {
        const member = await this.members.require(userId, request.workspaceId)
        const holder = request.take ? member.displayName || "staff" : null
        return this.entityManager.transaction(async (manager) => {
            await this.conversations.lockChat(request.workspaceId, request.conversationId, manager)
            await this.conversations.setChatHolder(request.workspaceId, request.conversationId, holder, manager)
            const line = request.line.slice(0, LINE_MAX)
            if (line.trim() !== "")
                await this.messages.storeLine(
                    request.workspaceId,
                    request.conversationId,
                    line.replaceAll("{user}", member.displayName),
                    manager,
                )
            return { conversationId: request.conversationId, handledBy: holder }
        })
    }

    /** Reads queue state rather than treating a failed retry attempt as a terminal failure. */
    async turnStatus(userId: string, request: AgentChatTurnStatusRequest): Promise<AgentChatTurnStatus> {
        await this.members.require(userId, request.workspaceId)
        const message = await this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.id", "id")
            .addSelect("m.conversation_id", "conversationId")
            .addSelect("c.channel", "channel")
            .addSelect("m.role", "role")
            .addSelect("m.delivery_status", "deliveryStatus")
            .addSelect("r.id", "replyId")
            .addSelect("r.delivery_status", "replyDeliveryStatus")
            .innerJoin(AgentConversationEntity, "c", "c.id = m.conversation_id AND c.workspace_id = m.workspace_id")
            .leftJoin(
                AgentMessageEntity,
                "r",
                "r.conversation_id = m.conversation_id AND r.workspace_id = m.workspace_id AND r.in_reply_to = m.id AND r.role = 'agent'",
            )
            .where("m.workspace_id = :workspaceId AND m.id = :id AND m.role IN ('user', 'agent')", {
                workspaceId: request.workspaceId,
                id: request.id,
            })
            .limit(1)
            .getRawOne<ChatTurnFacts>()
        if (message === undefined) throw new AgentChatError({ code: AgentChatErrorCode.TurnNotFound })
        const kind = message.role === "agent" ? "deliver" : "turn"
        const queued = await this.queueStatus.status(
            request.workspaceId,
            "chat_turn",
            `chat-turn.${kind}:${message.id}`,
        )
        if (queued === null) throw new AgentChatError({ code: AgentChatErrorCode.TurnNotFound })
        const deliveryFailed =
            message.channel !== "website" &&
            (kind === "deliver" ? message.deliveryStatus === "failed" : message.replyDeliveryStatus === "failed")
        let status: AgentChatTurnStatus["status"] = "queued"
        if (queued.state === "running") status = "running"
        if (queued.state === "failed" || (queued.state === "done" && deliveryFailed)) status = "failed"
        if (queued.state === "done" && !deliveryFailed) status = "succeeded"
        let errorCode: string | null = null
        if (status === "failed") errorCode = deliveryFailed ? "CHAT_DELIVERY_FAILED" : "CHAT_TURN_FAILED"
        return {
            id: message.id,
            jobId: queued.id,
            conversationId: message.conversationId,
            status,
            resultMessageId: kind === "deliver" ? message.id : message.replyId,
            errorCode,
        }
    }

    private async requireAgent(request: AgentChatAgentRequest): Promise<ChatAgentFacts> {
        const row = await this.entityManager
            .createQueryBuilder(AgentEntity, "a")
            .select(["a.id AS id", "a.module AS module", "a.status AS status", "a.greeting AS greeting"])
            .where("a.workspace_id = :workspaceId AND a.id = :agentId", {
                workspaceId: request.workspaceId,
                agentId: request.agentId,
            })
            .limit(1)
            .getRawOne<ChatAgentFacts>()
        if (row === undefined) throw new AgentChatError({ code: AgentChatErrorCode.AgentNotFound })
        return row
    }

    private async requireConversation(request: AgentChatConversationRequest): Promise<void> {
        const found = await this.conversations.targetOf(request.conversationId)
        if (found.kind !== "ok" || found.value.workspaceId !== request.workspaceId)
            throw new AgentChatError({ code: AgentChatErrorCode.ConversationNotFound })
    }

    private async isFoundingMember(workspaceId: string): Promise<boolean> {
        const offer = AGENT_CHAT_FOUNDING_OFFER
        const now = this.clock.now().getTime()
        if (!offer.enabled || now < Date.parse(offer.startsAt) || now > Date.parse(offer.endsAt)) return false
        return this.events.existsOfKindBetween(
            workspaceId,
            "module.purchased",
            new Date(offer.startsAt),
            new Date(offer.endsAt),
        )
    }
}
