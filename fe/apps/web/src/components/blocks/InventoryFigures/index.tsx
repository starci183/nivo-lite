"use client"

import { useFormatter, useTranslations } from "next-intl"
import { inventoryFigures, useInventoryWorkbenchData } from "@/hooks/inventoryWorkbench"
import { InventoryFiguresBase } from "./component"

/** The connected figures of the inventory workbench: items under their reorder level, orders waiting, stock value and stock-outs. */
export const InventoryFigures = () => {
    const t = useTranslations("workbenchInventory")
    const format = useFormatter()
    const { data } = useInventoryWorkbenchData()
    return (
        <InventoryFiguresBase
            props={{
                ariaLabel: t("tab_stock"),
                isLoading: data === undefined,
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
            }}
        />
    )
}
