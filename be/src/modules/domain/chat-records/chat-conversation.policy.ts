import type { ListedRecord, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q, type FilterExpr, type Query } from "@nivo-lite/agent-sdk/query"
import type { ConversationState } from "@nivo-lite/blocks-core/rules/chatbot"
import type {
    ConversationData,
    ChatConversationRef,
    ChatConversationTarget,
    ChatHumanConversation,
    OptionalChatConversationParty,
} from "./chat-records.contracts"

import { conversationDataSchema } from "./chat-records.schema"

/** The entity of a conversation. */
export const CONVERSATION_ENTITY = "chat.conversation"

/** The fields a query for conversation rows selects. */
export const CONVERSATION_SELECT: ReadonlyArray<string> = [
    "channel",
    "connectionId",
    "externalId",
    "name",
    "waiting",
    "handledBy",
    "lastText",
    "lastRole",
    "lastAt",
    "messageCount",
    "agentId",
    "frontAgentId",
    "connectorPartyId",
    "connectorPartyName",
]

/** A conversation row with its fields read, its workspace and the lead it links to. */
export interface ConversationFacts {
    /** The record id. */
    readonly id: string
    /** The record version: the token a write expects. */
    readonly version: string
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation's fields. */
    readonly data: ConversationData
    /** The agent that speaks in it. */
    readonly agentId: string
    /** The id of the linked lead, or null. */
    readonly leadId: string | null
}

/** The conversation a listed record holds; null when its fields are not a conversation's or no agent speaks in it. */
export const factsOf = (listed: Pick<ListedRecord, "row" | "joined">): ConversationFacts | null => {
    const parsed = conversationDataSchema.safeParse(listed.row.data)
    if (!parsed.success || parsed.data.agentId === null) return null
    return {
        id: listed.row.id,
        version: listed.row.version,
        workspaceId: listed.row.workspaceId,
        data: parsed.data,
        agentId: parsed.data.agentId,
        leadId: listed.joined["lead"]?.id ?? null,
    }
}

/** The facts of a plain record (no join): the lead is not read. */
export const plainFactsOf = (row: RecordRow): ConversationFacts | null => factsOf({ row, joined: {} })

/** A query for the conversations a condition selects, newest first. */
export const conversationQuery = (where: FilterExpr, size: number): Query => ({
    from: CONVERSATION_ENTITY,
    select: CONVERSATION_SELECT,
    join: { lead: ["contactName"] },
    where,
    order: [
        ["lastAt", "desc"],
        ["id", "desc"],
    ],
    page: { size },
})

/** A query for the one conversation a key condition selects (its id, or its customer on a connection). */
export const oneConversationQuery = (where: FilterExpr): Query => ({
    from: CONVERSATION_ENTITY,
    select: CONVERSATION_SELECT,
    join: { lead: ["contactName"] },
    where,
    order: [["id", "asc"]],
    page: { size: 1 },
})

/** The condition of one conversation by id. */
export const byId = (id: string): FilterExpr => q.eq("id", id)

/** The condition of the conversation of one customer on one connection. */
export const byCustomer = (channel: string, connectionId: string, customerId: string): FilterExpr =>
    q.and(q.eq("channel", channel), q.eq("connectionId", connectionId), q.eq("externalId", customerId))

/** The conversation as the intake reads it. */
export const refOf = (facts: ConversationFacts): ChatConversationRef => ({
    id: facts.id,
    agentId: facts.agentId,
    leadId: facts.leadId,
    handledBy: facts.data.handledBy,
    visitorName: facts.data.name === "" ? null : facts.data.name,
})

/** Where the replies of the conversation go. */
export const targetOf = (facts: ConversationFacts): ChatConversationTarget => ({
    id: facts.id,
    workspaceId: facts.workspaceId,
    channel: facts.data.channel,
    externalId: facts.data.externalId,
    connectionId: facts.data.connectionId,
})

/** The conversation a member may hold or reply in. */
export const humanOf = (facts: ConversationFacts): ChatHumanConversation => ({
    ...targetOf(facts),
    leadId: facts.leadId,
    handledBy: facts.data.handledBy,
})

/** The state the Chatbot rules start a change from. */
export const stateOf = (facts: ConversationFacts): ConversationState => ({
    lastText: facts.data.lastText,
    lastRole: facts.data.lastRole,
    lastAt: facts.data.lastAt,
    messageCount: facts.data.messageCount,
    waiting: facts.data.waiting,
    handledBy: facts.data.handledBy,
})

/** The connector party the conversation remembers, or null while it remembers none (or the conversation is not there). */
export const partyOfFacts = (facts: ConversationFacts | null): OptionalChatConversationParty => {
    const partyId = facts?.data.connectorPartyId ?? null
    return facts === null || partyId === null ? null : { partyId, name: facts.data.connectorPartyName ?? "" }
}
