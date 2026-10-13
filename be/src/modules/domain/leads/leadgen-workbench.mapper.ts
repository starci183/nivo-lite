import type {
    LeadGenComment,
    LeadGenHandoff,
    LeadGenLead,
    LeadGenSource,
    LeadGenWorkbenchData,
    LeadOrigin,
} from "./leadgen-workbench.contracts"
import type { LeadGenLeadRow, LeadGenWorkbenchRow, LeadGenWorkItemRow } from "./persistence/leadgen-workbench.rows"
import { conversationFacts, median, vnDayStart } from "./leadgen-conversations.mapper"
import { clip, firstText, leadOriginOf, platformOf, scoreFromFields, text } from "./leadgen-origin.policy"

const DAY_MS = 86_400_000
const CONVERSION_WINDOW_DAYS = 90
const OPEN_STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal"]
const MAX_LEAD_ROWS = 100
const fieldsOf = (item: Pick<LeadGenWorkItemRow, "proposal">): Record<string, unknown> => item.proposal?.fields ?? {}

/** The oldest instant used to measure lead conversion and replies. */
export const conversionSinceIso = (nowMs: number): string =>
    new Date(nowMs - CONVERSION_WINDOW_DAYS * DAY_MS).toISOString()

/** The newest work item of each lead for one action. */
const latestBy = (items: ReadonlyArray<LeadGenWorkItemRow>, action: string): Map<string, LeadGenWorkItemRow> => {
    const out = new Map<string, LeadGenWorkItemRow>()
    for (const item of items)
        if (item.action === action && item.lead_id && !out.has(item.lead_id)) out.set(item.lead_id, item)
    return out
}

/** Derives the whole Lead Gen workbench from the rows the flow already writes; every source field is read defensively. */
export const buildLeadGenWorkbench = (rows: LeadGenWorkbenchRow): LeadGenWorkbenchData => {
    const { nowMs, installationId } = rows
    const ownLead = (lead: LeadGenLeadRow): boolean =>
        installationId === null || lead.installation_id === installationId
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
            origin: leadOriginOf(fields, text(fields.channel_label), lead.channel),
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
            const origin = leadOriginOf(fields, text(fields.channel_label), "")
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
