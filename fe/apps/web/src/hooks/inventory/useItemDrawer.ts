"use client"

import { useTranslations } from "next-intl"
import type { ItemView, SupplierView } from "@/modules/types"
import { unitsText } from "./inventory.shared"
import type { ItemFormField, ItemFormValues } from "./inventory.shared"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import { useDrawer } from "./useDrawer"
import { useInventoryRun } from "./useInventoryRun"
import { useSay } from "./useSay"

/** The item drawer while it is open: the item being changed (null adds one) and what was typed. */
interface ItemDrawerState {
    readonly item: ItemView | null
    readonly values: ItemFormValues
}

const startItemState = (item: ItemView | null): ItemDrawerState => ({
    item,
    values: {
        sku: item?.sku ?? "",
        name: item?.name ?? "",
        unit: item?.unit ?? "",
        units: item === null ? "" : unitsText(item),
        category: item?.category ?? "",
        cost: item === null ? "" : String(item.costVnd),
        sell: item?.sellPriceVnd == null ? "" : String(item.sellPriceVnd),
        reorderPoint: item === null ? "" : String(item.reorderPoint),
        reorderQty: item === null ? "" : String(item.reorderQty),
        supplierId: item?.supplierId ?? "",
        aliases: item?.aliases.join(", ") ?? "",
        openingQty: "",
    },
})

/** Opens, fills and saves the item form; `props` is null while the drawer is closed. */
export const useItemDrawer = (
    suppliers: ReadonlyArray<SupplierView>,
    commands: InventoryCommandSet<"saveItem" | "setItemActive">,
) => {
    const t = useTranslations("workbenchInventory")
    const say = useSay()
    const run = useInventoryRun()
    const drawer = useDrawer<ItemDrawerState>()
    const { state } = drawer
    const item = state?.item ?? null
    return {
        open: (target: ItemView | null) => drawer.open(startItemState(target)),
        props:
            state === null
                ? null
                : {
                      say,
                      editing: item === null ? null : item.name,
                      active: item === null ? null : item.active,
                      values: state.values,
                      suppliers: suppliers.map((supplier) => ({ id: supplier.id, label: supplier.name })),
                      isPending: run.isPending,
                      error: run.error,
                  },
        on: {
            field: (name: ItemFormField, value: string) =>
                drawer.change((current) => ({ ...current, values: { ...current.values, [name]: value } })),
            save: () => {
                if (state === null) return
                run.exec(
                    () => commands.saveItem({ ...(item === null ? {} : { id: item.id }), ...state.values }),
                    drawer.done,
                )
            },
            toggleActive: () => {
                if (item !== null) run.exec(() => commands.setItemActive(item.id, !item.active), drawer.done)
            },
            close: drawer.close,
        },
    }
}
