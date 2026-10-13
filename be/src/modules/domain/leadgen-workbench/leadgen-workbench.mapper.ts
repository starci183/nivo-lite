import type { WorkItem } from "@modules/domain/work-items"
import {
    conversionSinceIso,
    LEAD_GEN_CONVERSION_DAYS,
    leadConversationFacts,
    leadGenDayStart,
    medianReply,
} from "./leadgen-conversation.policy"
import {
    clipLeadText,
    firstSourceText,
    leadOriginOf,
    leadPlatformOf,
    leadScoreOf,
    sourceText,
} from "./leadgen-source.policy"
import type {
    LeadGenComment,
    LeadGenHandoff,
    LeadGenLead,
    LeadGenRows,
    LeadGenSource,
    LeadGenWorkbench,
} from "./leadgen-workbench.contracts"

const OPEN_STAGES = ["new", "qualified", "proposal"]
const MAX_LEAD_ROWS = 100
const TEST_RUN = /UAT|DBG/u

const latestBy = (items: ReadonlyArray<WorkItem>, action: string): Map<string, WorkItem> => {
    const latest = new Map<string, WorkItem>()
    for (const item of items) {
        if (item.action === action && item.lead_id && !latest.has(item.lead_id)) latest.set(item.lead_id, item)
    }
    return latest
}

const commentsOf = (items: ReadonlyArray<WorkItem>): Array<LeadGenComment> =>
    items
        .filter((item) => item.action === "reply_comment_public" && item.status === "waiting_decision")
        .map((item) => {
            const fields = item.proposal.fields
            const origin = leadOriginOf(fields, sourceText(fields.channel_label), "")
            return {
                workItemId: item.id,
                platform: origin.platform,
                author: firstSourceText(fields, ["author", "author_name", "commenter", "sender_name", "contact_name"]),
                comment:
                    firstSourceText(fields, ["comment", "comment_text", "text", "message", "body"]) ||
                    item.proposal.summary,
                draft: item.proposal.draft ?? "",
                refLabel: origin.refLabel ?? origin.refId,
                at: item.created_at,
            }
        })
        .sort((a, b) => a.at.localeCompare(b.at))

const sourcesOf = (leads: ReadonlyArray<LeadGenLead>): Array<LeadGenSource> => {
    const sources = new Map<string, LeadGenSource>()
    for (const lead of leads) {
        const key = `${lead.origin.platform}:${lead.origin.kind}:${lead.origin.refKind ?? ""}:${lead.origin.refId ?? ""}`
        const prior = sources.get(key) ?? { key, origin: lead.origin, leads: 0, hot: 0, won: 0 }
        sources.set(key, {
            ...prior,
            leads: prior.leads + 1,
            hot: prior.hot + (lead.score === "hot" ? 1 : 0),
            won: prior.won + (lead.stage === "won" ? 1 : 0),
        })
    }
    return [...sources.values()].sort((a, b) => b.leads - a.leads || b.hot - a.hot)
}

/** Derives the Lead Gen workbench from rows already scoped to the caller's workspace. */
export const buildLeadGenWorkbench = (rows: LeadGenRows): LeadGenWorkbench => {
    const ownItems = rows.items.filter(
        (item) =>
            item.department === "lead_gen" &&
            (rows.installationId === null || item.installation_id === rows.installationId),
    )
    const capture = latestBy(ownItems, "capture_lead")
    const scoring = latestBy(ownItems, "score_lead")
    const handoff = latestBy(ownItems, "handoff_to_sales")
    const classify = latestBy(rows.items, "classify_lead")
    const leads = rows.leads.filter(
        (lead) =>
            (rows.installationId === null || lead.installation_id === rows.installationId) &&
            !TEST_RUN.test(lead.contact_name) &&
            !TEST_RUN.test(lead.company) &&
            (capture.has(lead.id) ||
                handoff.has(lead.id) ||
                scoring.has(lead.id) ||
                leadPlatformOf(lead.channel) !== "other"),
    )
    const facts = leadConversationFacts(rows)
    const leadRows: Array<LeadGenLead> = leads
        .map((lead) => {
            const fields = capture.get(lead.id)?.proposal.fields ?? {}
            const last = facts.last.get(lead.id)
            return {
                id: lead.id,
                name: lead.contact_name,
                stage: lead.stage,
                score: leadScoreOf(scoring.get(lead.id)?.proposal.fields ?? {}) ?? leadScoreOf(fields),
                origin: leadOriginOf(fields, sourceText(fields.channel_label), lead.channel),
                lastText: last?.text ?? clipLeadText(lead.need),
                lastAt: last?.at ?? lead.created_at,
                createdAt: lead.created_at,
                href: `/leads/${lead.id}`,
            }
        })
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    const scoreById = new Map(leadRows.map((lead) => [lead.id, lead.score]))
    const handoffs: Array<LeadGenHandoff> = []
    for (const [leadId, item] of handoff) {
        const lead = leadById.get(leadId)
        if (!lead) continue
        handoffs.push({
            key: item.id,
            leadId,
            name: lead.contact_name,
            score: scoreById.get(leadId) ?? null,
            at: item.completed_at ?? item.created_at,
            classify: classify.get(leadId)?.status ?? null,
            stage: lead.stage,
            href: `/leads/${leadId}`,
        })
    }
    const inWindow = leads.filter((lead) => lead.created_at >= conversionSinceIso(rows.nowMs))
    const dayStart = leadGenDayStart(rows.nowMs)
    const replyMedian = medianReply(facts.replyMinutes)
    return {
        metrics: {
            newToday: leads.filter((lead) => lead.created_at >= dayStart).length,
            hotWaiting: leadRows.filter(
                (lead) =>
                    lead.score === "hot" &&
                    OPEN_STAGES.includes(lead.stage) &&
                    classify.get(lead.id)?.status !== "done",
            ).length,
            firstReplyP50Min: replyMedian === null ? null : Math.round(replyMedian * 10) / 10,
            firstReplySample: facts.replyMinutes.length,
            conversionWindowDays: LEAD_GEN_CONVERSION_DAYS,
            conversionLeads: inWindow.length,
            conversionWon: inWindow.filter((lead) => lead.stage === "won").length,
        },
        leads: leadRows.slice(0, MAX_LEAD_ROWS),
        leadsHidden: Math.max(0, leadRows.length - MAX_LEAD_ROWS),
        sources: sourcesOf(leadRows),
        comments: commentsOf(ownItems),
        handoffs: handoffs.sort((a, b) => b.at.localeCompare(a.at)),
    }
}
