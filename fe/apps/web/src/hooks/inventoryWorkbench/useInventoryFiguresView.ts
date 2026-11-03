"use client"

import { useFormatter, useTranslations } from "next-intl"
import { inventoryFigures } from "./inventoryWorkbench.shared"
import type { InventoryPanelInput } from "./inventoryWorkbench.shared"
import type { Figure } from "@starci/grammar/common"
/** The view `useInventoryFiguresView` returns. */
export interface InventoryFiguresView {
    readonly label: string
    readonly items: readonly Figure[]
}

/** Resolves the four real inventory metrics from the workbench's authoritative board. */
export const useInventoryFiguresView = (input: InventoryPanelInput): InventoryFiguresView => {
    const t = useTranslations("workbenchInventory"),
        format = useFormatter()
    return {
        label: t("tab_stock"),
        items: inventoryFigures(input.board, {
            t,
            money: (value) => format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
        }),
    } as const
}
