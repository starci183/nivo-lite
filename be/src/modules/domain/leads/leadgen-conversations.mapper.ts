import type { LeadGenConversationFacts, LeadGenLastMessage } from "./leadgen-conversations.contracts"
import type { LeadGenWorkbenchInput, LeadGenMessageRecord } from "./leadgen-workbench.contracts"
import { clip } from "./leadgen-origin.policy"

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000
const REPLY_WINDOW_DAYS = 30

/** Midnight of the reporting day in the workspace time zone. */
export const vnDayStart = (now: number): number => Math.floor((now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS

/** The middle first-reply time, or null when no conversation has a reply. */
export const median = (values: ReadonlyArray<number>): number | null => {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Keeps the newest non-system message across a lead's conversations. */
const retainLast = (
    last: Map<string, LeadGenLastMessage>,
    leadId: string | null | undefined,
    final: LeadGenMessageRecord | undefined,
): void => {
    if (!leadId || !final) return
    const current = last.get(leadId)
    if (!current || final.created_at > current.at) last.set(leadId, { text: clip(final.body), at: final.created_at })
}

/** Last message per lead and the minutes from a first message to its first reply inside the reply window. */
export const conversationFacts = (rows: LeadGenWorkbenchInput): LeadGenConversationFacts => {
    const leadOfConversation = new Map(
        rows.conversations.map((conversation) => [conversation.id, conversation.lead_id]),
    )
    const byConversation = new Map<string, Array<LeadGenMessageRecord>>()
    for (const message of rows.messages) {
        if (!leadOfConversation.has(message.conversation_id)) continue
        const list = byConversation.get(message.conversation_id)
        if (list) list.push(message)
        else byConversation.set(message.conversation_id, [message])
    }
    const last = new Map<string, LeadGenLastMessage>()
    const replyMinutes: Array<number> = []
    const replyCut = new Date(rows.nowMs - REPLY_WINDOW_DAYS * DAY_MS).toISOString()
    for (const [conversationId, list] of byConversation) {
        const talk = list.filter((message) => message.role !== "system")
        const leadId = leadOfConversation.get(conversationId)
        const final = talk.at(-1)
        retainLast(last, leadId, final)
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
