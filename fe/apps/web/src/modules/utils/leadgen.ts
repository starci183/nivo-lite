import type { WorkStatus } from "@/lib/flow-types"
import type { LeadGenWorkbenchQuery } from "@/modules/api"
import type { LeadGenWorkbenchData, LeadOrigin, LeadPlatform, LeadScore, LeadSourceKind } from "@/modules/types"

const platformOf = (value: string): LeadPlatform => (value === "facebook" || value === "instagram" ? value : "other")
const kindOf = (value: string): LeadSourceKind =>
    value === "lead_ad" || value === "dm" || value === "comment" || value === "mention" ? value : "other"
const scoreOf = (value: string | null | undefined): LeadScore | null =>
    value === "hot" || value === "warm" || value === "cold" ? value : null
const workStatusOf = (value: string | null | undefined): WorkStatus | null =>
    value === "queued" || value === "done" || value === "waiting_decision" || value === "rejected" || value === "failed"
        ? value
        : null

const originOf = (origin: LeadGenWorkbenchQuery["leadGenWorkbench"]["sources"][number]["origin"]): LeadOrigin => ({
    platform: platformOf(origin.platform),
    kind: kindOf(origin.kind),
    refKind: origin.refKind === "post" || origin.refKind === "ad" || origin.refKind === "form" ? origin.refKind : null,
    refId: origin.refId ?? null,
    refLabel: origin.refLabel ?? null,
})

/** Normalizes optional GraphQL values and open string fields for the existing workbench views. */
export const toLeadGenWorkbenchData = (data: LeadGenWorkbenchQuery["leadGenWorkbench"]): LeadGenWorkbenchData => ({
    metrics: { ...data.metrics, firstReplyP50Min: data.metrics.firstReplyP50Min ?? null },
    leads: data.leads.map((row) => ({ ...row, score: scoreOf(row.score), origin: originOf(row.origin) })),
    leadsHidden: data.leadsHidden,
    sources: data.sources.map((row) => ({ ...row, origin: originOf(row.origin) })),
    comments: data.comments.map((row) => ({
        ...row,
        platform: platformOf(row.platform),
        refLabel: row.refLabel ?? null,
    })),
    handoffs: data.handoffs.map((row) => ({ ...row, score: scoreOf(row.score), classify: workStatusOf(row.classify) })),
})
