import type { useQueryWorkItemsSwr } from "@/hooks/swr/api/graphql"

/** One work item as the back end lists it. */
type WorkItem = NonNullable<ReturnType<typeof useQueryWorkItemsSwr>["data"]>["items"][number]

/** The work item actions the loyalty tab decides. */
const LOYALTY_ACTIONS: ReadonlyArray<string> = ["award_points", "redeem_reward", "send_promo", "adjust_points"]

/** One loyalty decision waiting for a person, as the tab shows it. */
export interface LoyaltyPendingItem {
    readonly id: string
    readonly action: string
    readonly summary: string
    readonly draft: string
    readonly reason: string | null
    readonly amountVnd: number | null
    readonly createdAt: string
    readonly customer: string
    readonly assignedStaffId: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const customerOf = (fields: unknown): string => {
    if (!isRecord(fields)) return ""
    const customer = fields.customer
    return typeof customer === "string" ? customer : ""
}

/** The loyalty items among the waiting work items, in the shape the tab draws. */
export const pendingOf = (items: ReadonlyArray<WorkItem>): ReadonlyArray<LoyaltyPendingItem> =>
    items
        .filter((item) => LOYALTY_ACTIONS.includes(item.action))
        .map((item) => ({
            id: item.id,
            action: item.action,
            summary: item.proposal.summary,
            draft: item.proposal.draft ?? "",
            reason: item.reason ?? null,
            amountVnd: item.proposal.amount_vnd ?? null,
            createdAt: item.created_at,
            customer: customerOf(item.proposal.fields),
            assignedStaffId: item.assigned_staff_id ?? null,
        }))
