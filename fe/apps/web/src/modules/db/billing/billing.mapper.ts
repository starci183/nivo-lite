import type { Database } from "../../../../../../../supabase/types/database.types"

type Tables = Database["public"]["Tables"]

/** Where a workspace stands in its payment cycle. */
export type WorkspaceStatus = "pending_payment" | "active" | "past_due" | "cancelled"

/** Where one payment order is. */
export type OrderStatus = "pending" | "paid" | "expired" | "cancelled"

/** Plan: first payment or renewal. Upgrade: a higher plan for the prorated difference. Topup: a pack of extra credits. */
export type OrderKind = "plan" | "upgrade" | "topup"

/** One plan of the catalogue. */
export interface Plan {
    readonly code: string
    readonly name_vi: string
    readonly name_en: string
    readonly price_vnd: number
    readonly period: "month" | "year"
    readonly seats: number
    readonly features: { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> }
    readonly sort: number
    /** Monthly AI credits; null is unlimited. */
    readonly ai_credits_per_month: number | null
    /** A contract plan: shown, never bought in the app. */
    readonly is_custom: boolean
}

/** One payment order. */
export interface PaymentOrder {
    readonly id: string
    readonly workspace_id: string
    readonly plan_code: string
    readonly amount_vnd: number
    readonly order_code: string
    readonly status: OrderStatus
    readonly expires_at: string
    readonly paid_at: string | null
    readonly created_at: string
    readonly kind: OrderKind
    readonly pack_code: string | null
    /** What was sold, frozen at order time (top-up: credits; upgrade: the proration inputs). */
    readonly detail: Readonly<Record<string, unknown>>
}

/** The billing columns of a workspace with the caller's role in it. */
export interface BillingWorkspace {
    readonly id: string
    readonly name: string
    readonly status: WorkspaceStatus
    readonly plan_code: string | null
    readonly paid_until: string | null
    readonly role: string
}

/** A bank transfer a manager still has to look at. */
export interface ReviewTransaction {
    readonly id: number
    readonly status: string
    readonly transfer_amount: number
    readonly received_at: string
    readonly content: string | null
}

const linesOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : []

/** Maps a plans row; a features value that is not the { vi, en } object counts as empty lists. */
export const toPlan = (row: Tables["plans"]["Row"]): Plan => {
    const features = row.features
    const isObject = typeof features === "object" && features !== null && !Array.isArray(features)
    return {
        code: row.code,
        name_vi: row.name_vi,
        name_en: row.name_en,
        price_vnd: Number(row.price_vnd),
        period: row.period === "year" ? "year" : "month",
        seats: row.seats,
        features: isObject ? { vi: linesOf(features.vi), en: linesOf(features.en) } : { vi: [], en: [] },
        sort: row.sort,
        ai_credits_per_month: row.ai_credits_per_month === null ? null : Number(row.ai_credits_per_month),
        is_custom: row.is_custom,
    }
}

const STATUSES: ReadonlyArray<OrderStatus> = ["pending", "paid", "expired", "cancelled"]
const KINDS: ReadonlyArray<OrderKind> = ["plan", "upgrade", "topup"]

/** Maps a payment_orders row; an unknown status or kind falls back to the safest reading. */
export const toPaymentOrder = (row: Tables["payment_orders"]["Row"]): PaymentOrder => {
    const detail = row.detail
    return {
        id: row.id,
        workspace_id: row.workspace_id,
        plan_code: row.plan_code,
        amount_vnd: Number(row.amount_vnd),
        order_code: row.order_code,
        status: STATUSES.find((status) => status === row.status) ?? "cancelled",
        expires_at: row.expires_at,
        paid_at: row.paid_at,
        created_at: row.created_at,
        kind: KINDS.find((kind) => kind === row.kind) ?? "plan",
        pack_code: row.pack_code,
        detail: typeof detail === "object" && detail !== null && !Array.isArray(detail) ? detail : {},
    }
}

/** Maps a sepay_transactions row to what the review list shows. */
export const toReviewTransaction = (
    row: Pick<Tables["sepay_transactions"]["Row"], "id" | "status" | "transfer_amount" | "received_at" | "content">,
): ReviewTransaction => ({
    id: Number(row.id),
    status: row.status,
    transfer_amount: Number(row.transfer_amount),
    received_at: row.received_at,
    content: row.content,
})

const WORKSPACE_STATUSES: ReadonlyArray<WorkspaceStatus> = ["pending_payment", "active", "past_due", "cancelled"]

/** Reads a workspace status; an unknown value counts as cancelled (the payment page only). */
export const toWorkspaceStatus = (value: string): WorkspaceStatus =>
    WORKSPACE_STATUSES.find((status) => status === value) ?? "cancelled"
