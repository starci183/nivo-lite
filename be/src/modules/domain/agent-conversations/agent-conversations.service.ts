import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    ConversationRef,
    ConversationTarget,
    OpenConversation,
    OptionalChannel,
    OptionalLeadConversation,
    TurnConversation,
    ChatConversation,
    OpenChatConversation,
    ChatHolder,
} from "./agent-conversations.contracts"
import { AgentConversationsError, AgentConversationsErrorCode } from "./errors/agent-conversations.error"
import type {
    ConversationRefRow,
    ConversationTargetRow,
    LeadConversationRow,
    TurnConversationRow,
    ChatConversationRow,
} from "./persistence/agent-conversations.rows"
import {
    ARCHIVE_CONVERSATION,
    ATTACH_CONVERSATION_LEAD,
    HAND_CONVERSATION_TO_PERSON,
    FIND_LATEST_LEAD_CONVERSATION,
    FIND_CONVERSATION,
    FIND_CONVERSATION_TARGET,
    FIND_TURN_CONVERSATION,
    INSERT_CONVERSATION,
    REBIND_CONVERSATION_AGENT,
    UPDATE_VISITOR_NAME,
    LIST_CHAT_CONVERSATIONS,
    LOCK_CHAT_CONVERSATION,
    INSERT_CHAT_CONVERSATION,
    SET_CHAT_HOLDER,
} from "./persistence/agent-conversations.sql"

const refOf = (row: ConversationRefRow): ConversationRef => ({
    id: row.id,
    agentId: row.agent_id,
    leadId: row.lead_id,
    handledBy: row.handled_by,
    visitorName: row.visitor_name,
})

const targetOf = (row: ConversationTargetRow): ConversationTarget => ({
    id: row.id,
    workspaceId: row.workspace_id,
    channel: row.channel,
    externalId: row.external_id,
    connectionId: row.connection_id,
})

const chatOf = (row: ChatConversationRow): ChatConversation => ({
    id: row.id,
    kind: row.kind === "customer" ? "customer" : "test",
    channel: row.channel,
    visitorName: row.visitor_name,
    leadId: row.lead_id,
    handledBy: row.handled_by,
    createdAt: new Date(row.created_at).toISOString(),
})

@Injectable()
/** The conversations customers have with the workspace's agents on a channel; the only writer of agent_conversations. */
export class AgentConversationsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest hundred conversations of the agent in the proven workspace. */
    async listChat(workspaceId: string, agentId: string): Promise<ReadonlyArray<ChatConversation>> {
        return (
            await this.entityManager.query<Array<ChatConversationRow>>(LIST_CHAT_CONVERSATIONS, [workspaceId, agentId])
        ).map(chatOf)
    }

    /** Opens a test or simulated customer conversation inside the caller's transaction. */
    async openChat(input: OpenChatConversation, manager: EntityManager): Promise<ChatConversation> {
        const [row] = await manager.query<Array<ChatConversationRow>>(INSERT_CHAT_CONVERSATION, [
            input.workspaceId,
            input.agentId,
            input.kind,
            input.visitorName,
        ])
        if (row === undefined) throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotStored })
        return chatOf(row)
    }

    /** Locks and proves the chat belongs to the workspace before its state changes. */
    async lockChat(workspaceId: string, conversationId: string, manager: EntityManager): Promise<ChatConversation> {
        const [row] = await manager.query<Array<ChatConversationRow>>(LOCK_CHAT_CONVERSATION, [
            workspaceId,
            conversationId,
        ])
        if (row === undefined) throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotFound })
        return chatOf(row)
    }

    /** Writes who holds a chat using the transaction that already locked it. */
    async setChatHolder(
        workspaceId: string,
        conversationId: string,
        holder: ChatHolder,
        manager: EntityManager,
    ): Promise<void> {
        await manager.query(SET_CHAT_HOLDER, [workspaceId, conversationId, holder])
    }

    /** The conversation of one customer on one connection, or a refusal when they never wrote. */
    async find(
        workspaceId: string,
        channel: string,
        connectionId: string,
        customerId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<ConversationRef, AgentConversationsErrorCode>> {
        const row = (
            await manager.query<Array<ConversationRefRow>>(FIND_CONVERSATION, [
                workspaceId,
                channel,
                connectionId,
                customerId,
            ])
        )[0]
        return row === undefined ? refused(AgentConversationsErrorCode.NotFound) : ok(refOf(row))
    }

    /** Opens the conversation of a customer on a connection. */
    async open(input: OpenConversation, manager: EntityManager): Promise<ConversationRef> {
        const row = (
            await manager.query<Array<ConversationRefRow>>(INSERT_CONVERSATION, [
                input.workspaceId,
                input.agentId,
                input.channel,
                input.customerId,
                input.visitor,
                input.connectionId,
            ])
        )[0]
        if (row === undefined) throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotStored })
        return refOf(row)
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
        await manager.query(ARCHIVE_CONVERSATION, [workspaceId, channel, connectionId, customerId, archivedId])
    }

    /** The conversation follows the connection's current front-door agent. */
    async rebind(conversationId: string, agentId: string, manager: EntityManager): Promise<void> {
        await manager.query(REBIND_CONVERSATION_AGENT, [conversationId, agentId])
    }

    /** Names the customer of the conversation after the channel told who they are. */
    async rename(conversationId: string, name: string): Promise<void> {
        await this.entityManager.query(UPDATE_VISITOR_NAME, [conversationId, name])
    }

    /** The latest customer conversation of a lead, optionally only on one channel; null when there is none. */
    async latestOfLead(
        workspaceId: string,
        leadId: string,
        channel: OptionalChannel,
    ): Promise<OptionalLeadConversation> {
        const row = (
            await this.entityManager.query<Array<LeadConversationRow>>(FIND_LATEST_LEAD_CONVERSATION, [
                workspaceId,
                leadId,
                channel,
            ])
        )[0]
        return row === undefined
            ? null
            : { id: row.id, agentId: row.agent_id, channel: row.channel, visitorName: row.visitor_name }
    }

    /** A person holds the conversation from now on: the AI stays quiet until they hand it back. */
    async handToPerson(workspaceId: string, conversationId: string, holder: string): Promise<void> {
        await this.entityManager.query(HAND_CONVERSATION_TO_PERSON, [workspaceId, conversationId, holder])
    }

    /** Ties a conversation to the lead the customer became. */
    async attachLead(workspaceId: string, conversationId: string, leadId: string): Promise<void> {
        await this.entityManager.query(ATTACH_CONVERSATION_LEAD, [workspaceId, conversationId, leadId])
    }

    /** Where the replies of the conversation go, or a refusal when it does not exist. */
    async targetOf(conversationId: string): Promise<Outcome<ConversationTarget, AgentConversationsErrorCode>> {
        const row = (
            await this.entityManager.query<Array<ConversationTargetRow>>(FIND_CONVERSATION_TARGET, [conversationId])
        )[0]
        return row === undefined ? refused(AgentConversationsErrorCode.NotFound) : ok(targetOf(row))
    }

    /** The conversation a turn answers, with the agent that speaks in it, or a refusal when it does not exist. */
    async turnOf(conversationId: string): Promise<Outcome<TurnConversation, AgentConversationsErrorCode>> {
        const row = (
            await this.entityManager.query<Array<TurnConversationRow>>(FIND_TURN_CONVERSATION, [conversationId])
        )[0]
        if (row === undefined) return refused(AgentConversationsErrorCode.NotFound)
        return ok({
            ...targetOf(row),
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
