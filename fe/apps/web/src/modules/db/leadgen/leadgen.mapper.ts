import type { WorkItemView } from "@/lib/flow-types"
import type {
    LeadGenComment,
    LeadGenHandoff,
    LeadGenLead,
    LeadGenSource,
    LeadGenWorkbenchData,
    LeadOrigin,
    LeadPlatform,
    LeadScore,
    LeadSourceKind,
} from "@/modules/types"
import type { LeadsRow } from "../leads/leads.mapper"

/** A customer conversation of a lead. */
export interface LeadConversationSlim {
    readonly id: string
    readonly lead_id: string | null
}

/** One message of such a conversation. */
export interface LeadMessageSlim {
    readonly conversation_id: string
    readonly role: string
    readonly body: string
    readonly created_at: string
}

/** Everything the Lead Gen workbench is derived from. */
export interface LeadGenRows {
    readonly nowMs: number
    readonly installationId: string | null
    readonly leads: ReadonlyArray<LeadsRow>
    readonly items: ReadonlyArray<WorkItemView>
    readonly conversations: ReadonlyArray<LeadConversationSlim>
    /** The messages of those conversations inside the conversion window, oldest first. */
    readonly messages: ReadonlyArray<LeadMessageSlim>
    /** True when a customer name marks a test run, which no figure counts. */
    readonly isTestRun: (...names: ReadonlyArray<string | null | undefined>) => boolean
}

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000
const CONVERSION_WINDOW_DAYS = 90
const REPLY_WINDOW_DAYS = 30
const OPEN_STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal"]
const MAX_LEAD_ROWS = 100
const SCORE_KEYS = ["score", "lead_score", "temperature", "rating", "grade"] as const

/** The window of conversations and messages the builder looks back over, as an ISO instant. */
export const conversionSinceIso = (nowMs: number): string =>
    new Date(nowMs - CONVERSION_WINDOW_DAYS * DAY_MS).toISOString()

type Fields = Record<string, unknown>

const text = (value: unknown): string => {
    if (typeof value === "string") return value.trim()
    return typeof value === "number" ? String(value) : ""
}

/** Lower case without the marks above letters, so a word matches however it was typed. */
const plain = (value: string): string => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

const firstText = (fields: Fields, keys: ReadonlyArray<string>): string => {
    for (const key of keys) {
        const value = text(fields[key])
        if (value) return value
    }
    return ""
}

const fieldsOf = (item: Pick<WorkItemView, "proposal">): Fields => item.proposal?.fields ?? {}

const clip = (value: string, n = 140): string => {
    const flat = value.replace(/\s+/g, " ").trim()
    return flat.length > n ? `${flat.slice(0, n - 1).trimEnd()}…` : flat
}

const platformOf = (...hints: ReadonlyArray<string>): LeadPlatform => {
    const joined = hints.join(" ").toLowerCase()
    if (joined.includes("instagram") || /\big\b/.test(joined)) return "instagram"
    if (joined.includes("facebook") || joined.includes("messenger") || joined.includes("meta")) return "facebook"
    return "other"
}

const kindOf = (raw: string, channelLabel: string): LeadSourceKind => {
    const joined = plain(`${raw} ${channelLabel}`)
    if (/lead[\s_-]?ad|leadgen|form/.test(joined)) return "lead_ad"
    if (/comment|binh luan/.test(joined)) return "comment"
    if (/mention|nhac/.test(joined)) return "mention"
    if (/\bdm\b|message|messenger|inbox|postback|tin nhan/.test(joined)) return "dm"
    return "other"
}

const SCORE_WORDS: Readonly<Record<string, LeadScore>> = {
    hot: "hot",
    nong: "hot",
    warm: "warm",
    am: "warm",
    cold: "cold",
    lanh: "cold",
}

const scoreOf = (value: unknown): LeadScore | null => SCORE_WORDS[plain(text(value))] ?? null

const scoreFromFields = (fields: Fields): LeadScore | null => {
    for (const key of SCORE_KEYS) {
        const score = scoreOf(fields[key])
        if (score) return score
    }
    return null
}

const refKindOf = (ad: string, form: string, post: string): LeadOrigin["refKind"] => {
    if (ad) return "ad"
    if (form) return "form"
    return post ? "post" : null
}

const originOf = (fields: Fields, channelLabel: string, fallbackChannel: string): LeadOrigin => {
    const label = channelLabel || fallbackChannel
    const platform = platformOf(firstText(fields, ["platform", "network"]), label, fallbackChannel)
    const kind = kindOf(
        firstText(fields, ["source_kind", "source_type", "capture_kind", "kind", "reason", "source"]),
        label,
    )
    const post = firstText(fields, ["post_id", "media_id", "post"])
    const ad = firstText(fields, ["ad_id", "ad"])
    const form = firstText(fields, ["form_id", "leadgen_form_id", "form"])
    const refKind = refKindOf(ad, form, post)
    const refId = ad || form || post || null
    const refLabel =
        firstText(fields, ["source_label", "post_title", "post_name", "ad_name", "form_name", "campaign_name"]) || null
    return { platform, kind, refKind, refId, refLabel }
}

/** The newest work item of each lead for one action. */
const latestBy = (items: ReadonlyArray<WorkItemView>, action: string): Map<string, WorkItemView> => {
    const out = new Map<string, WorkItemView>()
    for (const item of items)
        if (item.action === action && item.lead_id && !out.has(item.lead_id)) out.set(item.lead_id, item)
    return out
}

const vnDayStart = (now: number): number => Math.floor((now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS

const median = (values: ReadonlyArray<number>): number | null => {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Last message per lead and the minutes from a first message to its first reply inside the reply window. */
const conversationFacts = (
    rows: LeadGenRows,
): { last: Map<string, { text: string; at: string }>; replyMinutes: Array<number> } => {
    const leadOfConversation = new Map(
        rows.conversations.map((conversation) => [conversation.id, conversation.lead_id]),
    )
    const byConversation = new Map<string, Array<LeadMessageSlim>>()
    for (const message of rows.messages) {
        if (!leadOfConversation.has(message.conversation_id)) continue
        const list = byConversation.get(message.conversation_id)
        if (list) list.push(message)
        else byConversation.set(message.conversation_id, [message])
    }
    const last = new Map<string, { text: string; at: string }>()
    const replyMinutes: Array<number> = []
    const replyCut = new Date(rows.nowMs - REPLY_WINDOW_DAYS * DAY_MS).toISOString()
    for (const [conversationId, list] of byConversation) {
        const talk = list.filter((message) => message.role !== "system")
        const leadId = leadOfConversation.get(conversationId)
        const final = talk.at(-1)
        if (leadId && final) {
            const current = last.get(leadId)
            if (!current || final.created_at > current.at)
                last.set(leadId, { text: clip(final.body), at: final.created_at })
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

/** Derives the whole Lead Gen workbench from the rows the flow already writes; every source field is read defensively. */
export const buildLeadGenWorkbench = (rows: LeadGenRows): LeadGenWorkbenchData => {
    const { nowMs, installationId } = rows
    const ownLead = (lead: LeadsRow): boolean => installationId === null || lead.installation_id === installationId
    const leadGenItems = rows.items.filter(
        (item) =>
            item.department === "lead_gen" && (installationId === null || item.installation_id === installationId),
    )
    const capture = latestBy(leadGenItems, "capture_lead")
    const scoring = latestBy(leadGenItems, "score_lead")
    const handoffItem = latestBy(leadGenItems, "handoff_to_sales")
    const classify = latestBy(
        rows.items.filter((item) => item.action === "classify_lead"),
        "classify_lead",
    )
    const leads = rows.leads
        .filter(ownLead)
        .filter(
            (lead) =>
                !rows.isTestRun(lead.contact_name, lead.company) &&
                (capture.has(lead.id) ||
                    handoffItem.has(lead.id) ||
                    scoring.has(lead.id) ||
                    platformOf(lead.channel) !== "other"),
        )
    const facts = conversationFacts(rows)

    const leadRows: Array<LeadGenLead> = leads.map((lead) => {
        const captured = capture.get(lead.id)
        const fields = captured ? fieldsOf(captured) : {}
        const scored = scoring.get(lead.id)
        const last = facts.last.get(lead.id)
        return {
            id: lead.id,
            name: lead.contact_name,
            stage: lead.stage,
            score: (scored ? scoreFromFields(fieldsOf(scored)) : null) ?? scoreFromFields(fields),
            origin: originOf(fields, text(fields.channel_label), lead.channel),
            lastText: last?.text ?? clip(lead.need),
            lastAt: last?.at ?? lead.created_at,
            createdAt: lead.created_at,
            href: `/leads/${lead.id}`,
        }
    })
    leadRows.sort((a, b) => b.lastAt.localeCompare(a.lastAt))

    const sourceMap = new Map<string, { key: string; origin: LeadOrigin; leads: number; hot: number; won: number }>()
    for (const row of leadRows) {
        const key = `${row.origin.platform}:${row.origin.kind}:${row.origin.refKind ?? ""}:${row.origin.refId ?? ""}`
        const current = sourceMap.get(key) ?? { key, origin: row.origin, leads: 0, hot: 0, won: 0 }
        current.leads += 1
        if (row.score === "hot") current.hot += 1
        if (row.stage === "won") current.won += 1
        sourceMap.set(key, current)
    }
    const sources: Array<LeadGenSource> = [...sourceMap.values()].sort((a, b) => b.leads - a.leads || b.hot - a.hot)

    const comments: Array<LeadGenComment> = leadGenItems
        .filter((item) => item.action === "reply_comment_public" && item.status === "waiting_decision")
        .map((item) => {
            const fields = fieldsOf(item)
            const origin = originOf(fields, text(fields.channel_label), "")
            return {
                workItemId: item.id,
                platform: origin.platform,
                author: firstText(fields, ["author", "author_name", "commenter", "sender_name", "contact_name"]),
                comment:
                    firstText(fields, ["comment", "comment_text", "text", "message", "body"]) ||
                    item.proposal?.summary ||
                    "",
                draft: item.proposal?.draft ?? "",
                refLabel: origin.refLabel ?? origin.refId,
                at: item.created_at,
            }
        })
        .sort((a, b) => a.at.localeCompare(b.at))

    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    const scoreById = new Map(leadRows.map((row) => [row.id, row.score]))
    const handoffs: Array<LeadGenHandoff> = []
    for (const [leadId, handoff] of handoffItem) {
        const lead = leadById.get(leadId)
        if (!lead) continue
        handoffs.push({
            key: handoff.id,
            leadId,
            name: lead.contact_name,
            score: scoreById.get(leadId) ?? null,
            at: handoff.completed_at ?? handoff.created_at,
            classify: classify.get(leadId)?.status ?? null,
            stage: lead.stage,
            href: `/leads/${leadId}`,
        })
    }
    handoffs.sort((a, b) => b.at.localeCompare(a.at))

    const since = conversionSinceIso(nowMs)
    const dayStart = new Date(vnDayStart(nowMs)).toISOString()
    const inWindow = leads.filter((lead) => lead.created_at >= since)
    const p50 = median(facts.replyMinutes)
    return {
        metrics: {
            newToday: leads.filter((lead) => lead.created_at >= dayStart).length,
            hotWaiting: leadRows.filter(
                (row) =>
                    row.score === "hot" && OPEN_STAGES.includes(row.stage) && classify.get(row.id)?.status !== "done",
            ).length,
            firstReplyP50Min: p50 === null ? null : Math.round(p50 * 10) / 10,
            firstReplySample: facts.replyMinutes.length,
            conversionWindowDays: CONVERSION_WINDOW_DAYS,
            conversionLeads: inWindow.length,
            conversionWon: inWindow.filter((lead) => lead.stage === "won").length,
        },
        leads: leadRows.slice(0, MAX_LEAD_ROWS),
        leadsHidden: Math.max(0, leadRows.length - MAX_LEAD_ROWS),
        sources,
        comments,
        handoffs,
    }
}

/** What approving a comment reply takes. */
export interface CommentApprovalInput {
    readonly workItemId: string
    readonly draft: string | null
}

type Parse<T> = { readonly success: true; readonly data: T } | { readonly success: false }

/** Bounds the work item and the optional edited reply. */
export const commentApprovalSchema = {
    safeParse: (input: unknown): Parse<CommentApprovalInput> => {
        if (typeof input !== "object" || input === null) return { success: false }
        const fields = Object.fromEntries(Object.entries(input))
        const id = fields.workItemId
        const draft = fields.draft
        if (typeof id !== "string" || id.length < 1 || id.length > 64) return { success: false }
        if (draft !== null && (typeof draft !== "string" || draft.length > 4000)) return { success: false }
        return { success: true, data: { workItemId: id, draft } }
    },
}
