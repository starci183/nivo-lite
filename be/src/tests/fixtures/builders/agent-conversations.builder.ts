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

/** The joined row a turn read answers: the conversation of {@link leadConversation} with its agent. */
export const turnRow = {
    id: "conv-1",
    workspace_id: "ws-1",
    channel: "telegram",
    external_id: "555",
    connection_id: "c-1",
    lead_id: "lead-1",
    handled_by: "Lan",
    visitor_name: "Minh",
    installation_id: "inst-1",
    agent_id: "agent-1",
    agent_name: "Chatbot",
    agent_handle: "chatbot",
    agent_role: "Customer chat",
    agent_module: "chatbot",
    agent_instructions: "Be kind",
    agent_knowledge: "Tea",
    agent_approval_rule: "ask",
    agent_greeting: "Hi",
}
