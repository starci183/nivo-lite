"use client"

import { useFormatter, useTranslations } from "next-intl"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQuerySalesOrdersSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { leadPath } from "@/modules/routes"
import { SalesOrdersBase } from "./component"
import type { SalesOrderRowView } from "./component"

const STATUS_KEYS = {
    draft: "order_draft",
    confirmed: "order_confirmed",
    invoiced: "order_invoiced",
    paid: "order_paid",
    cancelled: "order_cancelled",
} as const

const statusKeyOf = (status: string): (typeof STATUS_KEYS)[keyof typeof STATUS_KEYS] =>
    status === "confirmed" || status === "invoiced" || status === "paid" || status === "cancelled"
        ? STATUS_KEYS[status]
        : STATUS_KEYS.draft

/** The workspace's order history, including older pages after the hand-off cards. */
export const SalesOrders = () => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQuerySalesOrdersSwr(activeWorkspaceId)
    const rows = query.data?.map((order): SalesOrderRowView => ({
        id: order.id,
        number: order.orderNo,
        items: order.items,
        leadHref: order.leadId === null ? null : leadPath(order.leadId),
        status: t(statusKeyOf(order.status)),
        amount:
            order.amountVnd === null
                ? t("orderAmountUnknown")
                : format.number(order.amountVnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
        createdAt: format.dateTime(new Date(order.createdAt), { dateStyle: "medium" }),
    }))
    return (
        <SalesOrdersBase
            props={{
                title: t("orderHistoryTitle"),
                slot: slotOfSwr({ data: rows, error: query.error, isLoading: query.isLoading }),
                slotLabels: slotLabels(t("orderHistoryEmpty")),
                hasNextPage: query.hasNextPage,
                isLoadingMore: query.isLoadingMore,
                paginationFailure: query.paginationError === undefined ? null : t("orderHistoryFailed"),
                loadMoreLabel: t("orderHistoryMore"),
                retryLabel: t("orderHistoryRetry"),
            }}
            on={{ loadMore: query.loadMore, retry: query.retry }}
        />
    )
}
