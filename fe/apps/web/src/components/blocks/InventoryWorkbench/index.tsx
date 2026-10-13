"use client"

import { useFormatter, useTranslations } from "next-intl"
import { INVENTORY_TAB_IDS } from "@/hooks/inventory"
import { inventoryFigures, useInventoryWorkbenchData } from "@/hooks/inventoryWorkbench"
import { InventoryWorkbenchBase } from "./component"

/** What the page hands the block: the deep link of `?tab=` and the installation the workbench is opened for. */
interface InventoryWorkbenchProps {
    readonly initialTab: string | null
    readonly installationId: string | null
}

/** The connected Inventory workbench: reads the inventory board from the back end GraphQL API and hands the settled view to the drawing half. */
export const InventoryWorkbench = (props: InventoryWorkbenchProps) => {
    const t = useTranslations("workbenchInventory")
    const format = useFormatter()
    const { data, isLoading } = useInventoryWorkbenchData()
    const openOrders = data === undefined || data.metrics.openPos === 0 ? "" : ` (${data.metrics.openPos})`
    return (
        <InventoryWorkbenchBase
            props={{
                installationId: props.installationId,
                initialTab: props.initialTab,
                isLoading: data === undefined && isLoading,
                isFailed: data === undefined && !isLoading,
                data,
                figures:
                    data === undefined
                        ? []
                        : inventoryFigures(data, {
                              t,
                              money: (value) =>
                                  format.number(value, {
                                      style: "currency",
                                      currency: "VND",
                                      maximumFractionDigits: 0,
                                  }),
                          }),
                tabs: INVENTORY_TAB_IDS.map((id) => ({
                    id,
                    label: id === "orders" ? `${t("tab_orders")}${openOrders}` : t(`tab_${id}`),
                })),
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
            }}
        />
    )
}
