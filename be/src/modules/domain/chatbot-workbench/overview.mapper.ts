import { isoOf } from "@modules/domain/brain-facts"
import type {
    ChatbotConversation,
    ChatbotMetrics,
    ChatbotOverview,
    ChatbotWaiting,
} from "./chatbot-workbench.contracts"
import {
    leadOf,
    proposalDraft,
    proposalQuestion,
    respondentOf,
    toConversation,
    waitingConversationId,
} from "./conversation.policy"
import type { CustomerConversationRow } from "@modules/domain/agent-conversations"
import type { MessageBrief } from "@modules/domain/agent-messages"
import type { LeadBriefRow, WaitingRow } from "./persistence/chatbot-workbench.rows"

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000
const MINUTE_MS = 60_000

/** The bounded records contributing to a Chatbot inbox snapshot. */
export interface OverviewRecords {
    /** The authorized workspace. */
    readonly workspaceId: string
    /** The injected clock's current instant in milliseconds. */
    readonly now: number
    /** Customer conversations of the selected Chatbot agents. */
    readonly conversations: ReadonlyArray<CustomerConversationRow>
    /** The last thirty days of conversation lines, oldest first. */
    readonly messages: ReadonlyArray<MessageBrief>
    /** Open customer reply escalations. */
    readonly waiting: ReadonlyArray<WaitingRow>
    /** Names, stages and capture dates of linked leads. */
    readonly leads: ReadonlyArray<LeadBriefRow>
    /** The agents of the desk being read. */
    readonly agentIds: ReadonlyArray<string>
    /** The names of the agents that speak in the conversations, by agent id. */
    readonly agentNames: ReadonlyMap<string, string>
    /** The names of the staff the waiting replies are assigned to, by staff id. */
    readonly staffNames: ReadonlyMap<string, string>
}

const median = (values: ReadonlyArray<number>): number | null => {
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const middle = sorted.slice(Math.floor((sorted.length - 1) / 2), mid + 1)
    return middle.reduce((sum, value) => sum + value, 0) / middle.length
}

const firstResponseMinutes = (lines: ReadonlyArray<MessageBrief>): number | null => {
    const user = lines.find((line) => line.role === "user")
    if (user === undefined) return null
    const userAt = Date.parse(isoOf(user.created_at))
    const reply = lines.find((line) => line.role === "agent" && Date.parse(isoOf(line.created_at)) > userAt)
    return reply === undefined ? null : (Date.parse(isoOf(reply.created_at)) - userAt) / MINUTE_MS
}

const emptyMetrics = (): ChatbotMetrics => ({
    today: 0,
    waiting: 0,
    p50FirstResponseMin: null,
    sample: 0,
    leadsCaptured7d: 0,
})

/** A snapshot for a Chatbot with no customer conversations. */
export const emptyChatbotOverview = (workspaceId: string, now: number): ChatbotOverview => ({
    workspaceId,
    nowIso: new Date(now).toISOString(),
    conversations: [],
    metrics: emptyMetrics(),
    waiting: [],
})

/** The waiting replies of the conversations in the list, oldest first, each with the customer it answers. */
const waitingOf = (records: OverviewRecords, conversations: ReadonlyArray<ChatbotConversation>) =>
    records.waiting.flatMap((item): Array<ChatbotWaiting> => {
        const conversation = conversations.find((row) => row.id === waitingConversationId(item))
        if (conversation === undefined) return []
        return [
            {
                workItemId: item.id,
                conversationId: conversation.id,
                channel: conversation.channel,
                name: conversation.name,
                question: proposalQuestion(item.proposal),
                draft: proposalDraft(item.proposal),
                staffName:
                    item.assigned_staff_id === null ? null : (records.staffNames.get(item.assigned_staff_id) ?? null),
                since: isoOf(item.created_at),
            },
        ]
    })

/** The conversation list by latest activity, with Vietnam-day and thirty-day response figures. */
export const buildChatbotOverview = (records: OverviewRecords): ChatbotOverview => {
    const waiting = new Set(records.waiting.map(waitingConversationId).filter((id): id is string => id !== null))
    const leadById = new Map(records.leads.map((lead) => [lead.id, lead]))
    const own = new Set(records.agentIds)
    const byConversation = new Map<string, Array<MessageBrief>>()
    for (const message of records.messages) {
        const lines = byConversation.get(message.conversation_id) ?? []
        lines.push(message)
        byConversation.set(message.conversation_id, lines)
    }
    const deltas: Array<number> = []
    const conversations = records.conversations
        .map((row) => {
            const lines = byConversation.get(row.id) ?? []
            const response = firstResponseMinutes(lines)
            if (response !== null) deltas.push(response)
            const lead = row.lead_id === null ? undefined : leadById.get(row.lead_id)
            return toConversation(row, lines, lead?.contact_name, waiting.has(row.id), {
                lead: leadOf(lead),
                respondent: respondentOf(row, own, records.agentNames),
            })
        })
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    const dayStart = Math.floor((records.now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS
    const p50 = median(deltas)
    return {
        workspaceId: records.workspaceId,
        nowIso: new Date(records.now).toISOString(),
        conversations,
        metrics: {
            today: records.conversations.filter((row) => Date.parse(isoOf(row.created_at)) >= dayStart).length,
            waiting: conversations.filter((row) => row.waiting).length,
            p50FirstResponseMin: p50 === null ? null : Math.round(p50 * 100) / 100,
            sample: deltas.length,
            leadsCaptured7d: records.leads.filter(
                (lead) => Date.parse(isoOf(lead.created_at)) >= records.now - 7 * DAY_MS,
            ).length,
        },
        waiting: waitingOf(records, conversations),
    }
}
