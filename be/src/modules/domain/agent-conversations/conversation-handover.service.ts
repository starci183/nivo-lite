import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectInstallations } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { ConversationOwnershipEventsService } from "@modules/domain/conversation-ownership-events"
import type { DealWonEvent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { EventDelivery } from "@modules/platform/event-bus"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { HandedConversation, HandOverParams, OptionalSpeakerId } from "./agent-conversations.contracts"
import { AgentConversationEntity } from "./persistence/entities"

const LOCALE = "vi"

/** The most conversations of one customer a hand-back returns at once. */
const HANDED_MAX = 20

@Injectable()
/**
 * Moves a customer conversation between two agents of the workspace and records why: the one door for the hand-over a Chatbot turn
 * asks for, the hand-over of a captured lead to Sales, and the hand-back to the front agent once the deal is won. The move and its
 * ownership record commit together; a conversation a person holds, or that the agent already speaks in, stays where it is.
 */
export class ConversationHandoverService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly ownership: ConversationOwnershipEventsService,
    ) {}

    /** Hands the conversation to the agent in one transaction; true when it moved. */
    handOver(params: HandOverParams): Promise<boolean> {
        return this.entityManager.transaction((manager) => this.move(manager, params))
    }

    /** The agent that speaks in the customer conversation, or null when a person holds it or the workspace has no such conversation. */
    async speakerOf(workspaceId: string, conversationId: string): Promise<OptionalSpeakerId> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { id: true, agentId: true, handledBy: true },
            where: { workspaceId, id: conversationId, kind: "customer" },
        })
        return row?.handledBy === null ? row.agentId : null
    }

    /**
     * The agent that speaks in the conversation is done: the conversation goes back to the agent that opened the door, with its record.
     * Nothing moves when that agent does not speak in it now, when a person holds it, or when it never left its front agent.
     */
    returnToFront(workspaceId: string, conversationId: string, fromAgentId: string): Promise<boolean> {
        return this.entityManager.transaction(async (manager) => {
            const row = await manager.findOne(AgentConversationEntity, {
                select: { id: true, agentId: true, frontAgentId: true },
                where: { workspaceId, id: conversationId, agentId: fromAgentId, handledBy: IsNull() },
                lock: { mode: "pessimistic_write" },
            })
            if (row?.frontAgentId == null || row.frontAgentId === fromAgentId) return false
            return this.move(manager, {
                workspaceId,
                conversationId,
                fromAgentId,
                toAgentId: row.frontAgentId,
                reason: this.catalog.get("handover.workDone", {}, LOCALE),
            })
        })
    }

    /**
     * The deal of a customer was won: every conversation of the customer that a Sales agent speaks in, with nobody holding it, returns
     * to the agent that opened the door. The delivery is claimed in the same transaction, so a redelivery changes nothing twice.
     */
    handBack(delivery: EventDelivery<DealWonEvent>): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim(delivery.consumer, delivery.dedupeKey, manager))) return
            const { workspaceId, leadId } = delivery.event.payload
            const handed = await this.lockHanded(manager, workspaceId, leadId)
            await eachInOrder(handed, (conversation) =>
                this.move(manager, {
                    workspaceId,
                    conversationId: conversation.id,
                    fromAgentId: conversation.agentId,
                    toAgentId: conversation.frontAgentId,
                    reason: this.catalog.get("handover.dealWon", {}, LOCALE),
                }),
            )
        })
    }

    /**
     * Locks the customer's conversations that another agent speaks in while a person holds none of them; each is returned with the agent
     * that opened the door. Empty when the customer has none.
     */
    private async lockHanded(
        manager: EntityManager,
        workspaceId: string,
        leadId: string,
    ): Promise<Array<HandedConversation>> {
        const rows = await manager.find(AgentConversationEntity, {
            select: { id: true, agentId: true, frontAgentId: true },
            where: { workspaceId, leadId, kind: "customer", frontAgentId: Not(IsNull()), handledBy: IsNull() },
            order: { createdAt: "ASC", id: "ASC" },
            take: HANDED_MAX,
            lock: { mode: "pessimistic_write" },
        })
        return rows.flatMap((row) =>
            row.frontAgentId === null || row.frontAgentId === row.agentId
                ? []
                : [{ id: row.id, agentId: row.agentId, frontAgentId: row.frontAgentId }],
        )
    }

    /**
     * The move and its record, inside the caller's transaction. It stays where it is while a person holds the conversation or when the
     * agent already speaks in it. The agent that opened the door is remembered once (`front_agent_id`): a second hand-over, or the
     * hand-back to the front agent, keeps the first.
     */
    private async move(manager: EntityManager, params: HandOverParams): Promise<boolean> {
        const installation = await this.installations.ofAgent(params.workspaceId, params.toAgentId)
        const updated = await manager
            .createQueryBuilder(AgentConversationEntity, "ac")
            .update()
            .set({
                agentId: params.toAgentId,
                frontAgentId: () => "COALESCE(front_agent_id, agent_id)",
                installationId: installation?.id ?? (() => "installation_id"),
            })
            .where(
                "workspace_id = :workspaceId AND id = :conversationId AND handled_by IS NULL AND agent_id <> :agentId",
                {
                    workspaceId: params.workspaceId,
                    conversationId: params.conversationId,
                    agentId: params.toAgentId,
                },
            )
            .returning("id")
            .execute()
        const moved = Array.isArray(updated.raw) && updated.raw.length > 0
        if (moved) {
            await this.ownership.record({
                manager,
                workspaceId: params.workspaceId,
                conversationId: params.conversationId,
                fromAgentId: params.fromAgentId,
                toAgentId: params.toAgentId,
                reason: params.reason,
            })
        }
        return moved
    }
}
