import { isoOf } from "@modules/domain/brain-facts"
import type {
    ChatbotChannel,
    ChatbotConversation,
    ChatbotConversationLead,
    ChatbotRespondent,
    ChatbotRole,
} from "./chatbot-workbench.contracts"
import type { CustomerConversationRow } from "@modules/domain/agent-conversations"
import type { MessageBrief } from "@modules/domain/agent-messages"
import type { WaitingRow } from "./persistence/chatbot-workbench.rows"

const CHANNELS: ReadonlyArray<ChatbotChannel> = ["telegram", "zalo", "facebook", "instagram"]

/** Unknown or internal channel names are represented as website chat. */
export const channelOf = (channel: string): ChatbotChannel => CHANNELS.find((known) => known === channel) ?? "website"

/** The message's conversational role, normalized to the three supported roles. */
export const roleOf = (role: string): ChatbotRole => (role === "agent" || role === "system" ? role : "user")

/** The conversation referred to by a waiting reply, preferring its explicit proposal field. */
export const waitingConversationId = (item: WaitingRow): string | null => {
    const fields = item.proposal?.fields
    if (typeof fields === "object" && fields !== null && !Array.isArray(fields) && "conversation_id" in fields) {
        const id = fields.conversation_id
        if (typeof id === "string") return id
    }
    return item.subject_id
}

const summaryOf = (proposal: WaitingRow["proposal"]): string => {
    const value = proposal?.summary
    return typeof value === "string" ? value : ""
}

/** The AI's draft answer of a waiting reply; empty when it wrote none. */
export const proposalDraft = (proposal: WaitingRow["proposal"]): string => {
    const value = proposal?.draft
    return typeof value === "string" ? value : ""
}

/** What the customer asked: the question field of the proposal, else its summary. */
export const proposalQuestion = (proposal: WaitingRow["proposal"]): string => {
    const fields = proposal?.fields
    if (typeof fields === "object" && fields !== null && !Array.isArray(fields) && "question" in fields) {
        return typeof fields.question === "string" ? fields.question : summaryOf(proposal)
    }
    return summaryOf(proposal)
}

/** The customer record facts a list entry shows. */
export interface ConversationLeadFacts {
    /** The journey stage. */
    readonly stage: string
    /** What the customer needs. */
    readonly need: string
    /** The company, empty when unknown. */
    readonly company: string
}

/** The customer record of a list entry; null while the customer was not captured. */
export const leadOf = (lead: ConversationLeadFacts | undefined): ChatbotConversationLead | null =>
    lead === undefined ? null : { stage: lead.stage, need: lead.need, company: lead.company }

/**
 * Who answers next. A person who holds the chat answers; else the AI of the desk that owns the agent; else, when a hand-over moved
 * the conversation to another agent of the workspace, that agent under its name. `own` holds the agents of the desk being read.
 */
export const respondentOf = (
    row: Pick<CustomerConversationRow, "agent_id" | "front_agent_id" | "handled_by">,
    own: ReadonlySet<string>,
    names: ReadonlyMap<string, string>,
): ChatbotRespondent => {
    if (row.handled_by !== null) return { kind: "person", name: row.handled_by }
    const handedOver = row.front_agent_id !== null && row.front_agent_id !== row.agent_id && !own.has(row.agent_id)
    return handedOver ? { kind: "agent", name: names.get(row.agent_id) ?? "" } : { kind: "ai", name: null }
}

/** The list entry of a conversation, derived from its stored lines and open escalation. */
export const toConversation = (
    row: CustomerConversationRow,
    messages: ReadonlyArray<MessageBrief>,
    leadName: string | undefined,
    waiting: boolean,
    customer: Pick<ChatbotConversation, "lead" | "respondent">,
): ChatbotConversation => {
    const talk = messages.filter((line) => line.role !== "system")
    const last = messages.at(-1)
    const lastTalk = talk.at(-1)
    const shown = lastTalk ?? last
    const body = shown?.body ?? ""
    return {
        id: row.id,
        channel: channelOf(row.channel),
        name: row.visitor_name?.trim() || leadName || "",
        leadId: row.lead_id,
        lastText: body.length > 140 ? body.slice(0, 139).trimEnd() + "..." : body,
        lastRole: shown === undefined ? null : roleOf(shown.role),
        lastAt: isoOf(last?.created_at ?? row.created_at),
        messageCount: talk.length,
        handledBy: row.handled_by,
        waiting,
        unanswered: lastTalk?.role === "user" && (waiting || row.handled_by !== null),
        lead: customer.lead,
        respondent: customer.respondent,
    }
}
