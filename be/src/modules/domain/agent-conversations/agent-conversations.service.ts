import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentEntity } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    ConversationRef,
    ConversationTarget,
    CustomerLeadConversation,
    HumanHolder,
    OptionalHumanConversation,
    OpenConversation,
    OptionalChannel,
    OptionalLeadConversation,
    TurnConversation,
    ChatConversation,
    OpenChatConversation,
    ChatHolder,
    HandToAgentParams,
    OptionalConversationParty,
    RememberPartyParams,
} from "./agent-conversations.contracts"
import { AgentConversationsError, AgentConversationsErrorCode } from "./errors/agent-conversations.error"
import { AgentConversationEntity } from "./persistence/entities"

/** The conversation of a turn with the agent that speaks in it, as the join of the two tables answers it. */
interface TurnConversationRead {
    readonly id: string
    readonly workspace_id: string
    readonly channel: string
    readonly external_id: string | null
    readonly connection_id: string | null
    readonly lead_id: string | null
    readonly handled_by: string | null
    readonly visitor_name: string | null
    readonly installation_id: string | null
    readonly agent_id: string
    readonly agent_name: string
    readonly agent_handle: string
    readonly agent_role: string
    readonly agent_module: string
    readonly agent_instructions: string
    readonly agent_knowledge: string
    readonly agent_approval_rule: string
    readonly agent_greeting: string
}

/** A chat conversation as the insert answers it (the columns the statement returns). */
interface InsertedChatRow {
    readonly id: string
    readonly kind: string
    readonly channel: string
    readonly visitor_name: string | null
    readonly lead_id: string | null
    readonly handled_by: string | null
    readonly created_at: Date
}

/** A customer conversation as the insert answers it (the columns the statement returns). */
interface InsertedRefRow {
    readonly id: string
    readonly agent_id: string
    readonly lead_id: string | null
    readonly handled_by: string | null
    readonly visitor_name: string | null
}

type ChatFields = Pick<
    AgentConversationEntity,
    "id" | "kind" | "channel" | "visitorName" | "leadId" | "handledBy" | "createdAt"
>

type TargetFields = Pick<AgentConversationEntity, "id" | "workspaceId" | "channel" | "externalId" | "connectionId">

const refOf = (
    row: Pick<AgentConversationEntity, "id" | "agentId" | "leadId" | "handledBy" | "visitorName">,
): ConversationRef => ({
    id: row.id,
    agentId: row.agentId,
    leadId: row.leadId,
    handledBy: row.handledBy,
    visitorName: row.visitorName,
})

const targetOf = (row: TargetFields): ConversationTarget => ({
    id: row.id,
    workspaceId: row.workspaceId,
    channel: row.channel,
    externalId: row.externalId,
    connectionId: row.connectionId,
})

const chatOf = (row: ChatFields): ChatConversation => ({
    id: row.id,
    kind: row.kind === "customer" ? "customer" : "test",
    channel: row.channel,
    visitorName: row.visitorName,
    leadId: row.leadId,
    handledBy: row.handledBy,
    createdAt: row.createdAt.toISOString(),
})

/** The columns of a conversation a chat reads. */
const CHAT_FIELDS = {
    id: true,
    kind: true,
    channel: true,
    visitorName: true,
    leadId: true,
    handledBy: true,
    createdAt: true,
} as const

/** What a holder change writes: the holder and the instant a person took over, or both cleared. */
const holding = (holder: string | null) => ({
    handledBy: holder,
    handledAt: holder === null ? null : () => "now()",
})

@Injectable()
/** The conversations customers have with the workspace's agents on a channel; the only writer of agent_conversations. */
export class AgentConversationsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Lead-linked customer conversations for a workbench whose caller has already proved membership. */
    async listCustomerLeadConversations(
        workspaceId: string,
        limit: number = 200,
    ): Promise<Array<CustomerLeadConversation>> {
        const rows = await this.entityManager.find(AgentConversationEntity, {
            select: { id: true, leadId: true, handledBy: true },
            where: { workspaceId, kind: "customer", leadId: Not(IsNull()) },
            order: { createdAt: "DESC", id: "DESC" },
            take: limit,
        })
        return rows.map((row) => ({ id: row.id, lead_id: row.leadId, handled_by: row.handledBy }))
    }

    /** The newest hundred conversations of the agent in the proven workspace. */
    async listChat(workspaceId: string, agentId: string): Promise<ReadonlyArray<ChatConversation>> {
        const rows = await this.entityManager.find(AgentConversationEntity, {
            select: CHAT_FIELDS,
            where: { workspaceId, agentId },
            order: { createdAt: "DESC", id: "DESC" },
            take: 100,
        })
        return rows.map(chatOf)
    }

    /** Opens an owner test or test customer conversation inside the caller's transaction. */
    async openChat(input: OpenChatConversation, manager: EntityManager): Promise<ChatConversation> {
        const inserted = await manager
            .createQueryBuilder(AgentConversationEntity, "ac")
            .insert()
            .values({
                workspaceId: input.workspaceId,
                agentId: input.agentId,
                kind: input.kind,
                visitorName: input.visitorName,
            })
            .returning("id, kind, channel, visitor_name, lead_id, handled_by, created_at")
            .execute()
        const [row] = inserted.raw as Array<InsertedChatRow>
        if (row === undefined) throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotStored })
        return chatOf({
            id: row.id,
            kind: row.kind === "customer" ? "customer" : "test",
            channel: row.channel,
            visitorName: row.visitor_name,
            leadId: row.lead_id,
            handledBy: row.handled_by,
            createdAt: new Date(row.created_at),
        })
    }

    /** Locks and proves the chat belongs to the workspace before its state changes. */
    async lockChat(workspaceId: string, conversationId: string, manager: EntityManager): Promise<ChatConversation> {
        const row = await manager.findOne(AgentConversationEntity, {
            select: CHAT_FIELDS,
            where: { workspaceId, id: conversationId },
            lock: { mode: "pessimistic_write" },
        })
        if (row === null) throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotFound })
        return chatOf(row)
    }

    /** Writes who holds a chat using the transaction that already locked it. */
    async setChatHolder(
        workspaceId: string,
        conversationId: string,
        holder: ChatHolder,
        manager: EntityManager,
    ): Promise<void> {
        await manager.update(AgentConversationEntity, { workspaceId, id: conversationId }, holding(holder))
    }

    /** The conversation of one customer on one connection, or a refusal when they never wrote. */
    async find(
        workspaceId: string,
        channel: string,
        connectionId: string,
        customerId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<ConversationRef, AgentConversationsErrorCode>> {
        const row = await manager.findOne(AgentConversationEntity, {
            select: { id: true, agentId: true, leadId: true, handledBy: true, visitorName: true },
            where: { workspaceId, channel, connectionId, externalId: customerId },
            order: { createdAt: "DESC" },
        })
        return row === null ? refused(AgentConversationsErrorCode.NotFound) : ok(refOf(row))
    }

    /** Opens the conversation of a customer on a connection. */
    async open(input: OpenConversation, manager: EntityManager): Promise<ConversationRef> {
        const inserted = await manager
            .createQueryBuilder(AgentConversationEntity, "ac")
            .insert()
            .values({
                workspaceId: input.workspaceId,
                agentId: input.agentId,
                kind: "customer",
                channel: input.channel,
                externalId: input.customerId,
                visitorName: input.visitor,
                connectionId: input.connectionId,
            })
            .returning("id, agent_id, lead_id, handled_by, visitor_name")
            .execute()
        const [row] = inserted.raw as Array<InsertedRefRow>
        if (row === undefined) throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotStored })
        return refOf({
            id: row.id,
            agentId: row.agent_id,
            leadId: row.lead_id,
            handledBy: row.handled_by,
            visitorName: row.visitor_name,
        })
    }

    /** "/start" opens a fresh visit: the previous conversation of the customer stays in history under the archived id. */
    async archive(
        workspaceId: string,
        channel: string,
        connectionId: string,
        customerId: string,
        archivedId: string,
        manager: EntityManager,
    ): Promise<void> {
        await manager.update(
            AgentConversationEntity,
            { workspaceId, channel, connectionId, externalId: customerId },
            { externalId: archivedId },
        )
    }

    /** The conversation follows the connection's current front-door agent. */
    async rebind(conversationId: string, agentId: string, manager: EntityManager): Promise<void> {
        await manager.update(AgentConversationEntity, { id: conversationId }, { agentId })
    }

    /** Names the customer of the conversation after the channel told who they are. */
    async rename(conversationId: string, name: string): Promise<void> {
        await this.entityManager.update(AgentConversationEntity, { id: conversationId }, { visitorName: name })
    }

    /** The latest customer conversation of a lead, optionally only on one channel; null when there is none. */
    async latestOfLead(
        workspaceId: string,
        leadId: string,
        channel: OptionalChannel,
    ): Promise<OptionalLeadConversation> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { id: true, agentId: true, channel: true, visitorName: true },
            where: { workspaceId, leadId, kind: "customer", ...(channel === null ? {} : { channel }) },
            order: { createdAt: "DESC" },
        })
        return row === null
            ? null
            : { id: row.id, agentId: row.agentId, channel: row.channel, visitorName: row.visitorName }
    }

    /** A person holds the conversation from now on: the AI stays quiet until they hand it back. */
    async handToPerson(workspaceId: string, conversationId: string, holder: string): Promise<void> {
        await this.entityManager.update(
            AgentConversationEntity,
            { workspaceId, id: conversationId },
            { handledBy: holder, handledAt: () => "now()" },
        )
    }

    /**
     * Hands the conversation to another agent in the caller's transaction; true when it moved. It stays where it is while a person
     * holds it or when that agent already speaks in it.
     */
    async handToAgent(params: HandToAgentParams): Promise<boolean> {
        const moved = await params.manager
            .createQueryBuilder(AgentConversationEntity, "ac")
            .update()
            .set({ agentId: params.agentId, installationId: params.installationId ?? (() => "installation_id") })
            .where(
                "workspace_id = :workspaceId AND id = :conversationId AND handled_by IS NULL AND agent_id <> :agentId",
                {
                    workspaceId: params.workspaceId,
                    conversationId: params.conversationId,
                    agentId: params.agentId,
                },
            )
            .returning("id")
            .execute()
        return Array.isArray(moved.raw) && moved.raw.length > 0
    }

    /**
     * True for an owner's test chat with an agent: its turns are real, but nothing it says may create a business record (no connector
     * write, no hand-off). A conversation that does not exist is not a test chat.
     */
    async isTestChat(conversationId: string): Promise<boolean> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { kind: true },
            where: { id: conversationId },
        })
        return row?.kind === "test"
    }

    /** The connector party the conversation remembers, or null while it remembers none. */
    async partyOf(workspaceId: string, conversationId: string): Promise<OptionalConversationParty> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { connectorPartyId: true, connectorPartyName: true },
            where: { workspaceId, id: conversationId, connectorPartyId: Not(IsNull()) },
        })
        const partyId = row?.connectorPartyId ?? null
        return partyId === null ? null : { partyId, name: row?.connectorPartyName ?? "" }
    }

    /** Remembers the party a connector answered for the conversation's customer; the latest answer wins. */
    async rememberParty(params: RememberPartyParams): Promise<void> {
        await this.entityManager.update(
            AgentConversationEntity,
            { workspaceId: params.workspaceId, id: params.conversationId },
            {
                connectorPartyId: params.party.partyId,
                connectorPartyName: params.party.name,
                connectorPartyAt: () => "now()",
            },
        )
    }

    /** Locks a workspace's customer conversation in the caller's transaction, or returns null when it is absent. */
    async lockForHuman(
        workspaceId: string,
        conversationId: string,
        manager: EntityManager,
    ): Promise<OptionalHumanConversation> {
        const row = await manager.findOne(AgentConversationEntity, {
            select: {
                id: true,
                workspaceId: true,
                channel: true,
                externalId: true,
                connectionId: true,
                leadId: true,
                handledBy: true,
            },
            where: { workspaceId, id: conversationId, kind: "customer" },
            lock: { mode: "pessimistic_write" },
        })
        return row === null ? null : { ...targetOf(row), leadId: row.leadId, handledBy: row.handledBy }
    }

    /** A member takes the locked customer conversation over or hands it back to the AI. */
    async setHumanHandling(
        workspaceId: string,
        conversationId: string,
        holder: HumanHolder,
        manager: EntityManager,
    ): Promise<void> {
        await manager.update(
            AgentConversationEntity,
            { workspaceId, id: conversationId, kind: "customer" },
            holding(holder),
        )
    }

    /** Ties a conversation to the lead the customer became. */
    async attachLead(workspaceId: string, conversationId: string, leadId: string): Promise<void> {
        await this.entityManager.update(AgentConversationEntity, { workspaceId, id: conversationId }, { leadId })
    }

    /** Where the replies of the conversation go, or a refusal when it does not exist. */
    async targetOf(conversationId: string): Promise<Outcome<ConversationTarget, AgentConversationsErrorCode>> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { id: true, workspaceId: true, channel: true, externalId: true, connectionId: true },
            where: { id: conversationId },
        })
        return row === null ? refused(AgentConversationsErrorCode.NotFound) : ok(targetOf(row))
    }

    /** The conversation a turn answers, with the agent that speaks in it, or a refusal when it does not exist. */
    async turnOf(conversationId: string): Promise<Outcome<TurnConversation, AgentConversationsErrorCode>> {
        const row = await this.entityManager
            .createQueryBuilder(AgentConversationEntity, "c")
            .select([
                "c.id AS id",
                "c.workspace_id AS workspace_id",
                "c.channel AS channel",
                "c.external_id AS external_id",
                "c.connection_id AS connection_id",
                "c.lead_id AS lead_id",
                "c.handled_by AS handled_by",
                "c.visitor_name AS visitor_name",
                "c.installation_id AS installation_id",
                "a.id AS agent_id",
                "a.name AS agent_name",
                "a.handle AS agent_handle",
                "a.role AS agent_role",
                "a.module AS agent_module",
                "a.instructions AS agent_instructions",
                "a.knowledge AS agent_knowledge",
                "a.approval_rule AS agent_approval_rule",
                "a.greeting AS agent_greeting",
            ])
            .innerJoin(AgentEntity, "a", "a.id = c.agentId")
            .where("c.id = :conversationId", { conversationId })
            .limit(1)
            .getRawOne<TurnConversationRead>()
        if (row === undefined) return refused(AgentConversationsErrorCode.NotFound)
        return ok({
            id: row.id,
            workspaceId: row.workspace_id,
            channel: row.channel,
            externalId: row.external_id,
            connectionId: row.connection_id,
            leadId: row.lead_id,
            handledBy: row.handled_by,
            visitorName: row.visitor_name,
            installationId: row.installation_id,
            agent: {
                id: row.agent_id,
                name: row.agent_name,
                handle: row.agent_handle,
                role: row.agent_role,
                module: row.agent_module,
                instructions: row.agent_instructions,
                knowledge: row.agent_knowledge,
                approvalRule: row.agent_approval_rule,
                greeting: row.agent_greeting,
            },
        })
    }
}
