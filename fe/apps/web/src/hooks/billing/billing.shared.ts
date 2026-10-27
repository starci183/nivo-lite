import type { useFormatter, useTranslations } from "next-intl"
import type {
    useQueryBillingPlanSwr,
    useQueryBillingReviewTransactionsSwr,
    useQueryBillingWorkspaceSwr,
    useQueryPaymentOrdersSwr,
} from "@/hooks/swr"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"
import type { BillingPlanView, BillingRowView, BillingTone, DataSlot } from "@/modules/types"

type BillingTranslator = ReturnType<typeof useTranslations<"billing">>
type BillingFormatter = ReturnType<typeof useFormatter>

/** The four reads the overview draws: the workspace, its plan, its payment orders and the transfers held for review. */
interface BillingReads {
    readonly workspace: ReturnType<typeof useQueryBillingWorkspaceSwr>
    readonly plan: ReturnType<typeof useQueryBillingPlanSwr>
    readonly orders: ReturnType<typeof useQueryPaymentOrdersSwr>
    readonly review: ReturnType<typeof useQueryBillingReviewTransactionsSwr>
}

/** The words and formats every billing row is drawn with. */
interface BillingWords {
    readonly t: BillingTranslator
    readonly format: BillingFormatter
    readonly money: (amount: number) => string
    readonly stamp: (value: string) => string
    readonly statusLabels: Record<string, string>
    readonly orderLabels: Record<string, string>
    readonly reviewLabels: Record<string, string>
}

/** Display tones for workspace billing states. */
const STATUS_TONES: Record<string, BillingTone> = {
    active: "success",
    pending_payment: "warning",
    past_due: "danger",
    cancelled: "neutral",
}

/** Display tones for payment order states. */
const ORDER_TONES: Record<string, BillingTone> = {
    paid: "success",
    pending: "warning",
    expired: "neutral",
    cancelled: "neutral",
}

/** Resolves the money and time formats and the status, order and review labels. */
export const billingWordsOf = (t: BillingTranslator, format: BillingFormatter): BillingWords => ({
    t,
    format,
    money: (amount: number) => format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    stamp: (value: string) =>
        format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: PRODUCT_TIME_ZONE }),
    statusLabels: {
        pending_payment: t("statusPending_payment"),
        active: t("statusActive"),
        past_due: t("statusPast_due"),
        cancelled: t("statusCancelled"),
    },
    orderLabels: {
        pending: t("orderPending"),
        paid: t("orderPaid"),
        expired: t("orderExpired"),
        cancelled: t("orderCancelled"),
    },
    reviewLabels: {
        underpaid: t("reviewUnderpaid"),
        expired: t("reviewExpired"),
        unmatched: t("reviewUnmatched"),
    },
})

/** A slot the viewer may not read becomes forbidden; any other slot passes through. */
const refusedOr = <T>(isRefused: boolean, slot: DataSlot<T>): DataSlot<T> => (isRefused ? { isForbidden: true } : slot)

/** The plan card: the plan, status and paid-until date of the workspace, waiting on and failing with the plan read it words. */
export const planCardOf = (
    words: BillingWords,
    locale: string,
    reads: Pick<BillingReads, "workspace" | "plan">,
    isRefused: boolean,
): DataSlot<BillingPlanView> => {
    const { t, format } = words
    const { plan } = reads
    const planSlot = refusedOr(
        isRefused,
        mapSlot(slotOfSwr(reads.workspace), (item): BillingPlanView => {
            let planName = t("noPlan")
            if (plan.data) planName = locale === "vi" ? plan.data.nameVi : plan.data.nameEn
            const status = item.status
            return {
                planName,
                status: words.statusLabels[status] ?? t("statusCancelled"),
                statusTone: STATUS_TONES[status] ?? "neutral",
                paidUntil: item.paidUntil
                    ? format.dateTime(new Date(item.paidUntil), { dateStyle: "long", timeZone: PRODUCT_TIME_ZONE })
                    : t("notPaid"),
                canRenew: Boolean(plan.data && !plan.data.isCustom),
            }
        }),
    )
    // The plan card also waits on, and fails with, the plan read it words.
    const planRead = slotOfSwr(plan)
    return planSlot.items !== undefined && (planRead.isLoading || planRead.isError)
        ? { isLoading: planRead.isLoading, isError: planRead.isError }
        : planSlot
}

/** The payment history rows: amount, when, plan and order code, and the order status. */
export const ordersSlotOf = (words: BillingWords, orders: BillingReads["orders"], isRefused: boolean) =>
    refusedOr(
        isRefused,
        mapSlot(slotOfSwr(orders), (items): ReadonlyArray<BillingRowView> =>
            items.map((order) => ({
                id: order.id,
                title: words.money(order.amountVnd),
                detail: `${words.stamp(order.createdAt)} · ${order.planCode} · ${order.orderCode}`,
                status: {
                    label: words.orderLabels[order.status] ?? order.status,
                    tone: ORDER_TONES[order.status] ?? "neutral",
                },
            })),
        ),
    )

/** The transfers held for review: why each is held, its amount and arrival time, and its transfer note. */
export const reviewSlotOf = (words: BillingWords, review: BillingReads["review"], isRefused: boolean) =>
    refusedOr(
        isRefused,
        mapSlot(slotOfSwr(review), (items): ReadonlyArray<BillingRowView> =>
            items.map((item) => ({
                id: String(item.id),
                title: words.reviewLabels[item.status] ?? item.status,
                detail: words.t("reviewReceived", {
                    amount: words.money(item.transferAmount),
                    date: words.stamp(item.receivedAt),
                }),
                content: item.content ?? undefined,
            })),
        ),
    )
