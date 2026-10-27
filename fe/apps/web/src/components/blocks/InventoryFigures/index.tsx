"use client"

import { useFormatter, useTranslations } from "next-intl"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { inventoryFigures, useInventoryWorkbenchData } from "@/hooks/inventoryWorkbench"
import { InventoryFiguresBase } from "./component"

/** The connected figures of the inventory workbench: items under their reorder level, orders waiting, stock value and stock-outs. */
export const InventoryFigures = () => {
    const t = useTranslations("workbenchInventory")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { data, error, isLoading, reload } = useInventoryWorkbenchData()
    const figures =
        data === undefined
            ? []
            : inventoryFigures(data, {
                  t,
                  money: (value) =>
                      format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
              })
    return (
        <InventoryFiguresBase
            props={{
                label: t("tab_stock"),
                slot: slotOfSwr({ data: data === undefined ? undefined : figures, error, isLoading }),
                labels: slotLabels(t("tab_stock")),
                placeholder: figures,
            }}
            on={{ retry: reload }}
        />
    )
}
