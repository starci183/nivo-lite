import type { LoyaltyCampaignView, Segment } from "./loyalty-campaigns.contracts"
import type { LoyaltyCampaignRow } from "./persistence/loyalty-campaigns.rows"

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
export const loyaltyCampaignOf = (row: LoyaltyCampaignRow): LoyaltyCampaignView => ({
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
