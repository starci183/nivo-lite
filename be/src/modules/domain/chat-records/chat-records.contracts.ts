import type { AgentTurnFacts } from "@modules/domain/agents"

/** The conversation a customer's channel message reached, as the intake reads it. */
export interface ChatConversationRef {
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

/** Where a conversation's replies go. */
export interface ChatConversationTarget {
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

/** The conversation a turn answers, with the agent that speaks in it. */
export interface ChatTurnConversation extends ChatConversationTarget {
    /** The lead the customer became, when they did. */
    readonly leadId: string | null
    /** Who holds the conversation when a person took it over, else null. */
    readonly handledBy: string | null
    /** The customer's name. */
    readonly visitorName: string | null
    /** The module installation (one branch's chatbot) of the speaking agent, when any. */
    readonly installationId: string | null
    /** The agent that speaks. */
    readonly agent: AgentTurnFacts
    /** The name the customer knows: the front agent's name after a hand-over, null while the speaking agent is the front door. */
    readonly speaksAs: string | null
}

/** A customer conversation a member may hold or reply in. */
export interface ChatHumanConversation extends ChatConversationTarget {
    /** The customer linked to the conversation. */
    readonly leadId: string | null
    /** The person currently holding it, or null when the AI handles it. */
    readonly handledBy: string | null
}

/** What opens the conversation of a customer on a connection. */
export interface ChatOpenConversation {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that speaks first. */
    readonly agentId: string
    /** The channel key. */
    readonly channel: string
    /** The customer's id on the channel. */
    readonly customerId: string
    /** The customer's name. */
    readonly visitor: string
    /** The connection the customer came in on. */
    readonly connectionId: string
}

/** What a meeting with a customer reached. */
export interface Met {
    /** The conversation, followed to the agent that meets the customer now. */
    readonly conversation: ChatConversationRef
    /** True when this meeting opened it. */
    readonly created: boolean
}

/** The party a connector keeps for the customer of a conversation, remembered on the conversation. */
export interface ChatConversationParty {
    /** The connector's party id. */
    readonly partyId: string
    /** The party's name as the connector keeps it, or empty. */
    readonly name: string
}

/** One message a customer said, with the time they said it. */
export interface ChatCustomerLine {
    /** The message. */
    readonly id: string
    /** What they said. */
    readonly body: string
    /** When they said it. */
    readonly at: Date
}

/** One stored message of a conversation. */
export interface ChatStoredMessage {
    /** The message id. */
    readonly id: string
    /** Who said it: user, agent or system. */
    readonly role: string
    /** What was said. */
    readonly body: string
    /** `sent` or `failed` once a delivery was tried, null before. */
    readonly deliveryStatus: string | null
}

/** The reply stored for one customer message. */
export interface ChatStoredReply {
    /** The reply message id. */
    readonly id: string
    /** The text that was stored, which is the earlier attempt's text when the reply already existed. */
    readonly body: string
    /** True when the reply already reached the customer. */
    readonly sent: boolean
}

/** One line of the transcript, without system lines. */
export interface ChatTranscriptLine {
    /** Who said it. */
    readonly role: "user" | "agent"
    /** What was said. */
    readonly body: string
}

/** Whether the stored message grants one outbound attempt, or already holds a delivery fact. */
export type ChatDeliveryClaim = "send" | "acknowledged" | "ambiguous" | "missing"

/** A person's reply: who wrote it. */
export interface HumanAuthor {
    /** The display name. */
    readonly name: string
    /** The account that typed it, or null. */
    readonly userId: string | null
}

/** One line the agent or a person says, stored once under its key. */
export interface AgentLine {
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation. */
    readonly conversationId: string
    /** What is said. */
    readonly body: string
    /** The key the line is stored under: the same key is the same line (a work item id, a customer message id). */
    readonly key: string
    /** The customer message it answers, when it is a reply. */
    readonly inReplyTo?: string | undefined
    /** Present when a person wrote it, absent for the agent. */
    readonly human?: HumanAuthor | undefined
}

/** When a message happened, if that is not when it was stored: the event's own time, and a tie-break for messages of the same millisecond. */
export interface ChatMessageStamp {
    /** The time the message happened, never later than when it was stored. */
    readonly at: Date
    /** Microseconds added to `at`, 0 to 999: a stable order for messages that share a millisecond. */
    readonly tieMicros: number
}

/** A person's name holding a conversation, or null while the AI answers it. */
export type OptionalHolder = string | null

/** A conversation a member may hold, or null when the workspace has no such conversation. */
export type OptionalChatHumanConversation = ChatHumanConversation | null

/** The party a conversation remembers, or null while it remembers none. */
export type OptionalChatConversationParty = ChatConversationParty | null

/** The channel's own id of a message, or null when the channel gave none. */
export type OptionalChannelRef = string | null

/** When a message happened if the channel timed it, or null for the time it was stored. */
export type OptionalMessageStamp = ChatMessageStamp | null

/** The key a line was stored under, or null when it is found by the customer message it answers. */
export type OptionalLineKey = string | null

/** The text of a stored line, or null before one is stored. */
export type OptionalLineText = string | null

/** A customer line a call stored or found stored. */
export interface StoredCustomerLine {
    /** The message id. */
    readonly id: string
    /** True when this call stored it, false when an earlier call of the same channel id had. */
    readonly stored: boolean
}

/** Who said a line: the customer, the agent or a person for it, or the system (a notice that is never sent). */
export type LineRole = "user" | "agent" | "system"

/** The declared fields of a `chat.conversation` record this capability reads. */
export interface ConversationData {
    /** The channel key. */
    readonly channel: string
    /** The connection the conversation came in on. */
    readonly connectionId: string | null
    /** The customer id on the channel. */
    readonly externalId: string | null
    /** The customer name. */
    readonly name: string
    /** Whether a question for a person is open. */
    readonly waiting: boolean
    /** The person who holds it, or null. */
    readonly handledBy: string | null
    /** The preview of the last spoken line. */
    readonly lastText: string
    /** The role of the last spoken line. */
    readonly lastRole: LineRole | null
    /** The moment of the last line, ISO 8601. */
    readonly lastAt: string | null
    /** How many spoken lines it holds. */
    readonly messageCount: number
    /** The agent that speaks in it. */
    readonly agentId: string | null
    /** The agent that opened the door. */
    readonly frontAgentId: string | null
    /** The connector party it remembers. */
    readonly connectorPartyId: string | null
    /** The remembered party name. */
    readonly connectorPartyName: string | null
}

/** The declared fields of a `chat.message` record this capability reads. */
export interface MessageData {
    /** The conversation. */
    readonly conversationId: string
    /** Who said it. */
    readonly role: LineRole
    /** What was said. */
    readonly text: string
    /** When it was said, ISO 8601. */
    readonly sentAt: string
    /** `sent` or `failed` once a delivery was tried. */
    readonly deliveryStatus: "sent" | "failed" | null
    /** Why the last delivery failed. */
    readonly deliveryError: string | null
    /** The key the line is stored under. */
    readonly channelRef: string | null
}

/** Which customers of a connection to list: those who wrote after a moment. */
export interface ChatFollowerQuery {
    /** The channel key. */
    readonly channel: string
    /** The connection. */
    readonly connectionId: string
    /** Only customers who wrote after this moment. */
    readonly since: Date
    /** The most customers to answer, 1 to 100. */
    readonly limit: number
}

/** A customer who wrote lately on a connection. */
export interface ChatFollower {
    /** The conversation. */
    readonly conversationId: string
    /** The customer's id on the channel, possibly with an archive suffix after a colon. */
    readonly externalId: string
    /** The customer's name, or empty. */
    readonly name: string
    /** When they last wrote, ISO 8601. */
    readonly lastAt: string
}

/** The lead a conversation became, or null when it became none. */
export type OptionalChatLeadId = string | null

/** The installation of a conversation (the one of its agent), or null when it has none. */
export type OptionalChatInstallationId = string | null
