"use client"

import type { InventoryPanelScope } from "./inventory.shared"
import type { ItemView, SupplierView } from "@/modules/types"
import { unitsText, type ItemFormField, type ItemFormValues } from "./inventory.shared"

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
    lifetime?: InventoryPanelScope,
) => {
    const { isActive = true, scope = "" } = lifetime ?? {}

    const say = useSay()
    const run = useInventoryRun(isActive, scope)
    const drawer = useDrawer<ItemDrawerState>(isActive, scope)
    const { state } = drawer
    const item = state?.item ?? null
    return {
        open: (target: ItemView | null) => drawer.open(startItemState(target)),
        props:
            state === null
                ? null
                : {
                      copy: itemDrawerCopy(say, item),
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
                    (_value, isCurrent) => (isCurrent() ? drawer.done() : undefined),
                )
            },
            toggleActive: () => {
                if (item !== null)
                    run.exec(
                        () => commands.setItemActive(item.id, !item.active),
                        (_value, isCurrent) => (isCurrent() ? drawer.done() : undefined),
                    )
            },
            close: drawer.close,
        },
    }
}

/** Resolves the exact item drawer copy in its domain owner. */
const itemDrawerCopy = (say: ReturnType<typeof useSay>, owner: ItemView | null) =>
    ({
        itemAddTitle: say("itemAddTitle"),
        itemEditTitle: say("itemEditTitle", { name: owner?.name ?? "" }),
        itemDrawerHint: say("itemDrawerHint"),
        close: say("close"),
        itemName: say("itemName"),
        itemSku: say("itemSku"),
        itemSkuHint: say("itemSkuHint"),
        itemUnit: say("itemUnit"),
        itemUnitHint: say("itemUnitHint"),
        itemUnits: say("itemUnits"),
        itemUnitsHint: say("itemUnitsHint"),
        itemCategory: say("itemCategory"),
        itemSupplier: say("itemSupplier"),
        itemSupplierNone: say("itemSupplierNone"),
        itemCost: say("itemCost"),
        itemSell: say("itemSell"),
        itemReorderPoint: say("itemReorderPoint"),
        itemReorderPointHint: say("itemReorderPointHint"),
        itemReorderQty: say("itemReorderQty"),
        itemAliases: say("itemAliases"),
        itemAliasesHint: say("itemAliasesHint"),
        itemOpening: say("itemOpening"),
        save: say("save"),
        itemStop: say("itemStop"),
        itemResume: say("itemResume"),
    }) as const
