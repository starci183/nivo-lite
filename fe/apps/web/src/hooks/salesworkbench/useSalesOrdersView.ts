"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQuerySalesOrdersSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { leadPath } from "@/modules/routes"
import type { SalesOrderRowView } from "@/modules/types"

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

/** The original blank order record used by the native collection's skeleton. */
const ORDER_PLACEHOLDER: ReadonlyArray<SalesOrderRowView> = [
    { id: "loading", number: "", items: "", leadHref: null, status: "", amount: "", createdAt: "" },
]

/** Owns the original independently paged order read only while its hand-off panel is mounted. */
export const useSalesOrdersView = (isActive: boolean) => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const labels = useSlotLabels()
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQuerySalesOrdersSwr(isActive ? activeWorkspaceId : undefined)
    return {
        props: {
            title: t("orderHistoryTitle"),
            placeholder: ORDER_PLACEHOLDER,
            slot: mapSlot(slotOfSwr(query), (orders) =>
                orders.map((order): SalesOrderRowView => ({
                    id: order.id,
                    number: order.orderNo,
                    items: order.items,
                    leadHref: order.leadId === null ? null : leadPath(order.leadId),
                    status: t(statusKeyOf(order.status)),
                    amount:
                        order.amountVnd === null
                            ? t("orderAmountUnknown")
                            : format.number(order.amountVnd, {
                                  style: "currency",
                                  currency: "VND",
                                  maximumFractionDigits: 0,
                              }),
                    createdAt: format.dateTime(new Date(order.createdAt), { dateStyle: "medium" }),
                })),
            ),
            labels: labels(t("orderHistoryEmpty")),
            hasNextPage: query.hasNextPage,
            isLoadingMore: query.isLoadingMore,
            paginationFailure: query.paginationError === undefined ? null : t("orderHistoryFailed"),
            loadMoreLabel: t("orderHistoryMore"),
            retryLabel: t("orderHistoryRetry"),
        },
        on: { loadMore: query.loadMore, retry: query.retry },
    }
}
