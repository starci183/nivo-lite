import type { CreditsHistoryRow } from "@/modules/types"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useRequireActiveWorkspace } from "@/hooks/workspaces"
import { useQueryBillingPlansSwr } from "@/hooks/swr"
import { useQueryPaymentOrdersSwr } from "@/hooks/swr"

/** Resolves the payment-history slot independently from the credits balance. */
export const useCreditsHistory = () => {
    const { activeWorkspaceId } = useRequireActiveWorkspace()
    const payments = useQueryPaymentOrdersSwr(activeWorkspaceId)
    const plans = useQueryBillingPlansSwr()
    const t = useTranslations("credits")
    const locale = useLocale()
    const formatter = useFormatter()
    const rows: ReadonlyArray<CreditsHistoryRow> = (payments.data ?? []).map((order) => {
        const plan = plans.data?.find((item) => item.code === order.planCode)
        let name = order.planCode
        if (plan) name = locale === "vi" ? plan.nameVi : plan.nameEn
        let title = t("orderPlan", { plan: name })
        if (order.kind === "topup")
            title = t("orderTopup", {
                credits: order.detail.credits == null ? "" : formatter.number(order.detail.credits),
            })
        if (order.kind === "credit_pack")
            title = t("orderPack", {
                credits: order.detail.credits == null ? "" : formatter.number(order.detail.credits),
            })
        if (order.kind === "upgrade") title = t("orderUpgrade", { plan: name })
        let status = t("orderPending")
        let tone: CreditsHistoryRow["tone"] = "warning"
        if (order.status === "paid") {
            status = t("orderPaid")
            tone = "success"
        }
        if (order.status === "expired") {
            status = t("orderExpired")
            tone = "neutral"
        }
        if (order.status === "cancelled") {
            status = t("orderCancelled")
            tone = "neutral"
        }
        const money = formatter.number(order.amountVnd, {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0,
        })
        const date = formatter.dateTime(new Date(order.createdAt), { dateStyle: "medium", timeStyle: "short" })
        return {
            id: order.id,
            title,
            description: money + " · " + t("orderMeta", { date, code: order.orderCode }),
            status,
            tone,
        }
    })
    return {
        props: {
            title: t("paymentsTitle"),
            loading: t("loading"),
            rows,
            slot: {
                isLoading: payments.isLoading || plans.isLoading || activeWorkspaceId === undefined,
                isError: Boolean(payments.error || plans.error),
                items: rows,
            },
            labels: {
                empty: t("paymentsEmpty"),
                forbidden: t("errForbidden"),
                error: t("errorText"),
                retry: t("retry"),
            },
        },
        on: {
            retry: () => {
                void payments.mutate()
                void plans.mutate()
            },
        },
    }
}
