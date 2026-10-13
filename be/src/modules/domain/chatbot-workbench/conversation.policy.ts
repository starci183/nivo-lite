import { isoOf } from "@modules/domain/brain-facts"
import type { ChatbotChannel, ChatbotConversation, ChatbotRole } from "./chatbot-workbench.contracts"
import type { ConversationRow, MessageBriefRow, WaitingRow } from "./persistence/chatbot-workbench.rows"

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

/** The list entry of a conversation, derived from its stored lines and open escalation. */
export const toConversation = (
    row: ConversationRow,
    messages: ReadonlyArray<MessageBriefRow>,
    leadName: string | undefined,
    waiting: boolean,
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
    }
}
