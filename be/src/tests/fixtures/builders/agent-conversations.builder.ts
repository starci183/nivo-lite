import { builder } from "@starci/jest-preset"
import { agentConversationsEntities } from "@modules/domain/agent-conversations"

const [AgentConversationEntity] = agentConversationsEntities
type AgentConversationEntity = InstanceType<typeof AgentConversationEntity>

/** A customer's Telegram conversation with the fields a spec rarely changes filled. */
export const conversationOf = builder<AgentConversationEntity>({
    id: "conv-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    kind: "customer",
    visitorName: "Minh",
    leadId: null,
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
    handledBy: null,
    handledAt: null,
    channel: "telegram",
    externalId: "555",
    connectionId: "c-1",
    installationId: null,
    connectorPartyId: null,
    connectorPartyName: null,
    connectorPartyAt: null,
})

/** The conversation of the customer 555 on the connection c-1. */
export const telegramConversation = (): AgentConversationEntity => conversationOf()

/** A website chat a person named Lan holds, linked to a lead. */
export const heldWebsiteChat = (): AgentConversationEntity =>
    conversationOf({
        id: "chat-1",
        channel: "website",
        leadId: "lead-1",
        handledBy: "Lan",
        externalId: null,
        connectionId: null,
    })

/** An owner's test chat nobody holds and no customer named. */
export const quietTestChat = (): AgentConversationEntity =>
    conversationOf({
        id: "chat-2",
        kind: "test",
        channel: "website",
        visitorName: null,
        externalId: null,
        connectionId: null,
    })

/** A customer conversation Lan holds, linked to a lead. */
export const leadConversation = (): AgentConversationEntity => conversationOf({ leadId: "lead-1", handledBy: "Lan" })

/** A conversation that remembers the connector party p1 named Lan. */
export const namedPartyConversation = (): AgentConversationEntity =>
    conversationOf({ connectorPartyId: "p1", connectorPartyName: "Lan" })

/** A conversation that remembers the connector party p2, which had no name. */
export const unnamedPartyConversation = (): AgentConversationEntity =>
    conversationOf({ connectorPartyId: "p2", connectorPartyName: null })

/** An owner's test chat. */
export const testConversation = (): AgentConversationEntity => conversationOf({ kind: "test" })

/** The row a chat insert returns for {@link heldWebsiteChat} (snake case columns, as the database answers). */
export const insertedChatRow = {
    id: "chat-1",
    kind: "customer",
    channel: "website",
    visitor_name: "Minh",
    lead_id: "lead-1",
    handled_by: "Lan",
    created_at: new Date("2026-10-13T02:00:00.000Z"),
}

/** The row a customer conversation insert returns. */
export const insertedRefRow = {
    id: "conv-1",
    agent_id: "agent-1",
    lead_id: null,
    handled_by: null,
    visitor_name: "Minh",
}

/** The conversation a turn answers: held by Lan, linked to a lead and to the installation inst-1. */
export const turnConversation = (): AgentConversationEntity =>
    conversationOf({ leadId: "lead-1", handledBy: "Lan", installationId: "inst-1" })
