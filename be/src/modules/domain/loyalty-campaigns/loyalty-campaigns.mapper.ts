import type { LoyaltyCampaignView, Segment } from "./loyalty-campaigns.contracts"

/** One campaign with its delivery counts, as the list statement answers it. */
export interface CampaignListRaw {
    /** The campaign id. */
    readonly id: string
    /** The owner-supplied name. */
    readonly name: string
    /** The stored segment, untrusted JSON. */
    readonly segment: unknown
    /** The customer message. */
    readonly draft: string
    /** Where the campaign stands. */
    readonly status: string
    /** The decision that approves it, when there is one. */
    readonly work_item_id: string | null
    /** The intended recipients. */
    readonly recipients: number
    /** Deliveries that were sent. */
    readonly sent: number
    /** Deliveries still waiting. */
    readonly queued: number
    /** Deliveries that failed. */
    readonly failed: number
    /** Deliveries that were skipped. */
    readonly skipped: number
    /** How long the draft took, in milliseconds. */
    readonly draft_ms: number | null
    /** Who created it. */
    readonly created_by: string
    /** When it was created. */
    readonly created_at: Date | string
    /** When it finished, when it did. */
    readonly finished_at: Date | string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const recordOf = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})
const numberOf = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
const instantOf = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value)

/** Resolves historical segments whose omitted conditions mean every customer. */
export const campaignSegmentOf = (value: unknown): Segment => {
    const record = recordOf(value)
    return {
        tiers: Array.isArray(record.tiers)
            ? record.tiers.filter((tier): tier is string => typeof tier === "string")
            : [],
        inactiveDays: numberOf(record.inactiveDays),
        birthdayThisMonth: record.birthdayThisMonth === true,
        minSpendVnd: numberOf(record.minSpendVnd),
    }
}

/** Maps one workspace-scoped campaign row to its workbench view. */
export const loyaltyCampaignOf = (row: CampaignListRaw): LoyaltyCampaignView => ({
    id: row.id,
    name: row.name,
    segment: campaignSegmentOf(row.segment),
    messageDraft: row.draft,
    draft: row.draft,
    status: row.status,
    workItemId: row.work_item_id,
    recipients: row.recipients,
    sent: row.sent,
    queued: row.queued,
    failed: row.failed,
    skipped: row.skipped,
    draftMs: row.draft_ms,
    createdBy: row.created_by,
    createdAt: instantOf(row.created_at),
    finishedAt: row.finished_at === null ? null : instantOf(row.finished_at),
    errorCode: row.status === "failed" ? "LOYALTY_CAMPAIGNS_FAILED" : null,
})
