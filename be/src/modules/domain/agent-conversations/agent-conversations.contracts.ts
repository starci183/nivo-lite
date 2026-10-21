import type { EntityManager } from "typeorm"

/** A conversation as the intake reads it. */
export interface ConversationRef {
    /** The conversation id. */
    readonly id: string
    /** The agent that speaks in it. */
    readonly agentId: string
    /** The lead the customer became, when they did. */
    readonly leadId: string | null
    /** Who holds the conversation when a person took it over, else null. */
    readonly handledBy: string | null
    /** The customer's name. */
    readonly visitorName: string | null
}

/** What opens the conversation of a customer on a connection. */
export interface OpenConversation {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that speaks first. */
    readonly agentId: string
    /** The channel key: telegram or zalo. */
    readonly channel: string
    /** The customer's id on the channel. */
    readonly customerId: string
    /** The customer's name. */
    readonly visitor: string
    /** The connection the customer came in on. */
    readonly connectionId: string
}

/** Where a conversation's replies go. */
export interface ConversationTarget {
    /** The conversation id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The channel key: telegram, zalo, facebook, instagram or website. */
    readonly channel: string
    /** The customer's id on that channel, possibly with an archive suffix after a colon. */
    readonly externalId: string | null
    /** The connection the conversation came in on. */
    readonly connectionId: string | null
}

/** The agent that speaks in a conversation. */
export interface TurnAgent {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The handle people mention it by. */
    readonly handle: string
    /** The role line. */
    readonly role: string
    /** The module: chatbot, booking or loyalty. */
    readonly module: string
    /** The owner's instructions. */
    readonly instructions: string
    /** The knowledge the agent may use. */
    readonly knowledge: string
    /** The approval rule. */
    readonly approvalRule: string
    /** The greeting that opens a visit. */
    readonly greeting: string
}

/** The conversation a turn answers, with the agent that speaks in it. */
export interface TurnConversation extends ConversationTarget {
    /** The lead the customer became, when they did. */
    readonly leadId: string | null
    /** Who holds the conversation when a person took it over, else null. */
    readonly handledBy: string | null
    /** The customer's name. */
    readonly visitorName: string | null
    /** The module installation (one branch's chatbot), when any. */
    readonly installationId: string | null
    /** The agent that speaks. */
    readonly agent: TurnAgent
}

/** The latest customer conversation of a lead. */
export interface LeadConversation {
    /** The conversation id. */
    readonly id: string
    /** The agent that speaks in it. */
    readonly agentId: string
    /** The channel key. */
    readonly channel: string
    /** The customer's name. */
    readonly visitorName: string | null
}

/** A channel key to narrow a search to, or null for any channel. */
export type OptionalChannel = string | null

/** A lead's conversation, or null when the customer never talked to an agent. */
export type OptionalLeadConversation = LeadConversation | null

/** A conversation in the agent chat history. */
export interface ChatConversation {
    /** The conversation id. */
    readonly id: string
    /** The chat mode. */
    readonly kind: "test" | "customer"
    /** The customer channel. */
    readonly channel: string
    /** The visitor name, when supplied. */
    readonly visitorName: string | null
    /** The captured lead, when any. */
    readonly leadId: string | null
    /** The person holding the conversation, when any. */
    readonly handledBy: string | null
    /** When the conversation opened, ISO 8601. */
    readonly createdAt: string
}

/** The bounded values opening an agent chat. */
export interface OpenChatConversation {
    /** The proven workspace. */
    readonly workspaceId: string
    /** The agent in that workspace. */
    readonly agentId: string
    /** An owner test chat or a test customer. */
    readonly kind: "test" | "customer"
    /** The visitor name, or null for the default. */
    readonly visitorName: string | null
}

/** A person's display name, or null while the agent holds the conversation. */
export type ChatHolder = string | null

/** The customer conversation a member may hold or reply in. */
export interface HumanConversation extends ConversationTarget {
    /** The customer linked to the conversation. */
    readonly leadId: string | null
    /** The person currently holding it, or null when the AI handles it. */
    readonly handledBy: string | null
}

/** A scoped customer conversation, absent when it does not belong to the workspace. */
export type OptionalHumanConversation = HumanConversation | null

/** The human holder, or null when the AI handles the conversation. */
export type HumanHolder = string | null

/** Hands a customer conversation to another agent in the caller's transaction. */
export interface HandToAgentParams {
    /** The transaction the move joins, so the move and its record commit together. */
    readonly manager: EntityManager
    /** The workspace of the conversation. */
    readonly workspaceId: string
    /** The conversation to move. */
    readonly conversationId: string
    /** The agent that speaks in it from now on. */
    readonly agentId: string
    /** The installation of that agent; null keeps the conversation's current installation. */
    readonly installationId: string | null
}

/** The party a connector keeps for the customer of a conversation, remembered on the conversation. */
export interface ConversationParty {
    /** The connector's party id. */
    readonly partyId: string
    /** The party's name as the connector keeps it, or empty. */
    readonly name: string
}

/** The remembered party of a conversation, or null while none is remembered. */
export type OptionalConversationParty = ConversationParty | null

/** Remembers the connector party of a workspace's conversation. */
export interface RememberPartyParams {
    /** The workspace of the conversation. */
    readonly workspaceId: string
    /** The conversation. */
    readonly conversationId: string
    /** The party the connector answered. */
    readonly party: ConversationParty
}
