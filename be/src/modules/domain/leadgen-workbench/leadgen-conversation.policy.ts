import type {
    LeadGenConversationFacts,
    LeadGenLastMessage,
    LeadGenMessage,
    LeadGenRows,
} from "./leadgen-workbench.contracts"
import { clipLeadText } from "./leadgen-source.policy"

/** Milliseconds in a calendar day. */
const LEAD_GEN_DAY_MS = 86_400_000
/** Days of lead creation included in conversion figures. */
export const LEAD_GEN_CONVERSION_DAYS = 90
const REPLY_WINDOW_DAYS = 30
const VN_OFFSET_MS = 7 * 3_600_000

/** The earliest message the workbench needs. */
export const conversionSinceIso = (nowMs: number): string =>
    new Date(nowMs - LEAD_GEN_CONVERSION_DAYS * LEAD_GEN_DAY_MS).toISOString()

/** Today begins at midnight in Vietnam time. */
export const leadGenDayStart = (nowMs: number): string =>
    new Date(Math.floor((nowMs + VN_OFFSET_MS) / LEAD_GEN_DAY_MS) * LEAD_GEN_DAY_MS - VN_OFFSET_MS).toISOString()

/** The median of recorded first reply delays; null when no customer received a reply. */
export const medianReply = (values: ReadonlyArray<number>): number | null => {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Last message per lead and first reply delays inside the last thirty days. */
export const leadConversationFacts = (rows: LeadGenRows): LeadGenConversationFacts => {
    const leadOfConversation = new Map(
        rows.conversations.map((conversation) => [conversation.id, conversation.lead_id]),
    )
    const byConversation = new Map<string, Array<LeadGenMessage>>()
    for (const message of rows.messages) {
        if (!leadOfConversation.has(message.conversation_id)) continue
        const list = byConversation.get(message.conversation_id)
        if (list) list.push(message)
        else byConversation.set(message.conversation_id, [message])
    }
    const last = new Map<string, LeadGenLastMessage>()
    const replyMinutes: Array<number> = []
    const replyCut = new Date(rows.nowMs - REPLY_WINDOW_DAYS * LEAD_GEN_DAY_MS).toISOString()
    for (const [conversationId, list] of byConversation) {
        const talk = list.filter((message) => message.role !== "system")
        const leadId = leadOfConversation.get(conversationId)
        const final = talk.at(-1)
        if (leadId && final) {
            const current = last.get(leadId)
            if (!current || final.created_at > current.at)
                last.set(leadId, { text: clipLeadText(final.body), at: final.created_at })
        }
        const firstUser = talk.find((message) => message.role === "user")
        const firstReply = firstUser
            ? talk.find((message) => message.role === "agent" && message.created_at > firstUser.created_at)
            : undefined
        if (firstUser && firstReply && firstUser.created_at >= replyCut) {
            replyMinutes.push((Date.parse(firstReply.created_at) - Date.parse(firstUser.created_at)) / 60_000)
        }
    }
    return { last, replyMinutes }
}
