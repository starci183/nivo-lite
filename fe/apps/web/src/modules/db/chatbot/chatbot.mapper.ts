import type { Database } from "../../../../../../../supabase/types/database.types"
import type {
    ChatbotChannel,
    ChatbotConversation,
    ChatbotLead,
    ChatbotMessage,
    ChatbotMetrics,
    ChatbotOverview,
    ChatbotRole,
    ChatbotThread,
} from "@/modules/types"

type Tables = Database["public"]["Tables"]

/** A conversation row. */
export type ConversationRow = Tables["agent_conversations"]["Row"]

/** The part of a message row the list needs. */
export type MessageBrief = Pick<
    Tables["agent_messages"]["Row"],
    "id" | "conversation_id" | "role" | "body" | "created_at"
>

/** A whole message row. */
export type MessageRow = Tables["agent_messages"]["Row"]

/** A waiting "reply to the customer" work item, as far as the list needs it. */
export type WaitingBrief = Pick<Tables["work_items"]["Row"], "id" | "subject_id" | "proposal">

/** A waiting work item with everything the escalation shows. */
export type WaitingRow = Tables["work_items"]["Row"]

/** The name and creation time of the lead a conversation points at. */
export type LeadBrief = Pick<Tables["leads"]["Row"], "id" | "contact_name" | "created_at">

/** The lead columns the customer panel shows. */
export type LeadRow = Pick<
    Tables["leads"]["Row"],
    "id" | "contact_name" | "company" | "stage" | "need" | "phone" | "email"
>

/** Everything the inbox is derived from. */
export interface OverviewRecords {
    readonly workspaceId: string
    readonly now: number
    readonly conversations: ReadonlyArray<ConversationRow>
    readonly messages: ReadonlyArray<MessageBrief>
    readonly waiting: ReadonlyArray<WaitingBrief>
    readonly leads: ReadonlyArray<LeadBrief>
}

/** Everything one open conversation is derived from. */
export interface ThreadRecords {
    readonly conversation: ConversationRow
    readonly messages: ReadonlyArray<MessageRow>
    readonly waiting: ReadonlyArray<WaitingRow>
    readonly lead: LeadRow | null
    readonly staffName: string | null
}

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000
const PREVIEW_LENGTH = 140
const MINUTE_MS = 60_000

const vnDayStart = (now: number): number => Math.floor((now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS

const median = (values: ReadonlyArray<number>): number | null => {
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 1 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

const clip = (text: string, length: number): string =>
    text.length > length ? `${text.slice(0, length - 1).trimEnd()}...` : text

const CHANNELS: ReadonlyArray<ChatbotChannel> = ["telegram", "zalo", "facebook", "instagram"]

/** The channel of a conversation; anything that is not a pushed channel is the website chat. */
export const channelOf = (channel: string): ChatbotChannel => CHANNELS.find((known) => known === channel) ?? "website"

const roleOf = (role: string): ChatbotRole => {
    if (role === "agent" || role === "system") return role
    return "user"
}

const toMessage = (row: MessageRow): ChatbotMessage => ({
    id: row.id,
    role: roleOf(row.role),
    authorKind: row.author_kind === "human" ? "human" : "ai",
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    delivery: row.delivery_status === "sent" || row.delivery_status === "failed" ? row.delivery_status : null,
    deliveryError: row.delivery_error,
})

/** The conversation id a waiting reply_customer item belongs to: the id in its proposal fields, else its subject. */
export const waitingConversationId = (item: WaitingBrief): string | null => {
    const proposal = item.proposal
    const fields = typeof proposal === "object" && proposal !== null && !Array.isArray(proposal) ? proposal.fields : null
    if (typeof fields === "object" && fields !== null && !Array.isArray(fields)) {
        const id = fields.conversation_id
        if (typeof id === "string") return id
    }
    return item.subject_id
}

/** Groups messages by conversation, keeping their order. */
const messagesByConversation = (messages: ReadonlyArray<MessageBrief>): ReadonlyMap<string, ReadonlyArray<MessageBrief>> => {
    const map = new Map<string, Array<MessageBrief>>()
    for (const message of messages) {
        const list = map.get(message.conversation_id)
        if (list === undefined) map.set(message.conversation_id, [message])
        else list.push(message)
    }
    return map
}

/** The state of one conversation seen through its last lines. */
interface ConversationLines {
    readonly last: { readonly role: string; readonly body: string; readonly created_at: string } | null
    readonly lastTalk: { readonly role: string; readonly body: string; readonly created_at: string } | null
    readonly talkCount: number
}

const linesOf = (lines: ReadonlyArray<{ readonly role: string; readonly body: string; readonly created_at: string }>): ConversationLines => {
    const talk = lines.filter((line) => line.role !== "system")
    return { last: lines.at(-1) ?? null, lastTalk: talk.at(-1) ?? null, talkCount: talk.length }
}

/** Minutes from the customer's first line to the first answer, or null while nobody answered. */
const firstResponseMinutes = (lines: ReadonlyArray<MessageBrief>): number | null => {
    const talk = lines.filter((line) => line.role !== "system")
    const firstUser = talk.find((line) => line.role === "user")
    if (firstUser === undefined) return null
    const firstReply = talk.find((line) => line.role === "agent" && line.created_at > firstUser.created_at)
    if (firstReply === undefined) return null
    return (Date.parse(firstReply.created_at) - Date.parse(firstUser.created_at)) / MINUTE_MS
}

/** The conversation as the list shows it. */
const toConversation = (
    row: ConversationRow,
    lines: ConversationLines,
    leadName: string | undefined,
    isWaiting: boolean,
): ChatbotConversation => {
    const shown = lines.lastTalk ?? lines.last
    return {
        id: row.id,
        channel: channelOf(row.channel),
        name: row.visitor_name?.trim() || leadName || "",
        leadId: row.lead_id,
        lastText: clip(shown?.body ?? "", PREVIEW_LENGTH),
        lastRole: shown === null ? null : roleOf(shown.role),
        lastAt: lines.last?.created_at ?? row.created_at,
        messageCount: lines.talkCount,
        handledBy: row.handled_by,
        waiting: isWaiting,
        unanswered: lines.lastTalk?.role === "user" && (isWaiting || row.handled_by !== null),
    }
}

const emptyMetrics = (): ChatbotMetrics => ({
    today: 0,
    waiting: 0,
    p50FirstResponseMin: null,
    sample: 0,
    leadsCaptured7d: 0,
})

/** The inbox of one Chatbot instance: conversations by latest activity and the header figures. */
export const buildChatbotOverview = (records: OverviewRecords): ChatbotOverview => {
    const nowIso = new Date(records.now).toISOString()
    const waiting = new Set(records.waiting.map(waitingConversationId).filter((id): id is string => id !== null))
    const leadName = new Map(records.leads.map((lead) => [lead.id, lead.contact_name]))
    const capturedSince = new Date(records.now - 7 * DAY_MS).toISOString()
    const byConversation = messagesByConversation(records.messages)
    const deltas: Array<number> = []
    const conversations = records.conversations
        .map((row) => {
            const lines = byConversation.get(row.id) ?? []
            const delta = firstResponseMinutes(lines)
            if (delta !== null) deltas.push(delta)
            const leadId = row.lead_id
            return toConversation(row, linesOf(lines), leadId === null ? undefined : leadName.get(leadId), waiting.has(row.id))
        })
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    const dayStart = vnDayStart(records.now)
    const p50 = median(deltas)
    return {
        workspaceId: records.workspaceId,
        nowIso,
        conversations,
        metrics: {
            ...emptyMetrics(),
            today: records.conversations.filter((row) => Date.parse(row.created_at) >= dayStart).length,
            waiting: conversations.filter((conversation) => conversation.waiting).length,
            p50FirstResponseMin: p50 === null ? null : Math.round(p50 * 100) / 100,
            sample: deltas.length,
            leadsCaptured7d: records.leads.filter((lead) => lead.created_at >= capturedSince).length,
        },
    }
}

/** The inbox of a Chatbot that has no conversations. */
export const emptyChatbotOverview = (workspaceId: string, now: number): ChatbotOverview => ({
    workspaceId,
    nowIso: new Date(now).toISOString(),
    conversations: [],
    metrics: emptyMetrics(),
})

const toLead = (row: LeadRow): ChatbotLead => ({
    id: row.id,
    name: row.contact_name,
    company: row.company,
    stage: row.stage,
    need: row.need,
    phone: row.phone,
    email: row.email,
})

/** The text a field of a proposal holds, or an empty string. */
const proposalText = (proposal: WaitingRow["proposal"], key: "summary" | "draft"): string => {
    if (typeof proposal !== "object" || proposal === null || Array.isArray(proposal)) return ""
    const value = proposal[key]
    return typeof value === "string" ? value : ""
}

/** The question the customer asked, from the proposal's fields, else its summary. */
const proposalQuestion = (proposal: WaitingRow["proposal"]): string => {
    const fields = typeof proposal === "object" && proposal !== null && !Array.isArray(proposal) ? proposal.fields : null
    if (typeof fields === "object" && fields !== null && !Array.isArray(fields) && fields.question !== undefined) {
        return String(fields.question)
    }
    return proposalText(proposal, "summary")
}

/** One conversation with its lines, lead and the open escalation (if any). */
export const buildChatbotThread = (records: ThreadRecords): ChatbotThread => {
    const { conversation } = records
    const item = records.waiting.find((work) => waitingConversationId(work) === conversation.id) ?? null
    const lines = linesOf(records.messages)
    const shown = lines.lastTalk ?? lines.last
    return {
        conversation: {
            id: conversation.id,
            channel: channelOf(conversation.channel),
            name: conversation.visitor_name?.trim() || records.lead?.contact_name || "",
            leadId: conversation.lead_id,
            lastText: clip(shown?.body ?? "", PREVIEW_LENGTH),
            lastRole: shown === null ? null : roleOf(shown.role),
            lastAt: lines.last?.created_at ?? conversation.created_at,
            messageCount: lines.talkCount,
            handledBy: conversation.handled_by,
            waiting: item !== null,
            unanswered: lines.lastTalk?.role === "user" && (item !== null || conversation.handled_by !== null),
        },
        messages: records.messages.map(toMessage),
        lead: records.lead === null ? null : toLead(records.lead),
        escalation:
            item === null
                ? null
                : {
                      workItemId: item.id,
                      question: proposalQuestion(item.proposal),
                      draft: proposalText(item.proposal, "draft"),
                      staffName: records.staffName,
                      since: item.created_at,
                  },
        externalId: conversation.external_id,
        handledAt: conversation.handled_at,
    }
}
