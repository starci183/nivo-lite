"use client"

import type { InventoryPanelScope } from "./inventory.shared"
import type { ItemView, SupplierView } from "@/modules/types"
import { unitsText, type ItemFormField, type ItemFormValues } from "./inventory.shared"

import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import { sayAll } from "@/modules/inventory"
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

/** The view `useItemDrawer` returns. */
export interface ItemDrawerView {
    open: (target: ItemView | null) => void
    props: {
        copy: {
            itemEditTitle: string
            close: string
            save: string
            itemAddTitle: string
            itemDrawerHint: string
            itemName: string
            itemSku: string
            itemSkuHint: string
            itemUnit: string
            itemUnitHint: string
            itemUnits: string
            itemUnitsHint: string
            itemCategory: string
            itemSupplier: string
            itemSupplierNone: string
            itemCost: string
            itemSell: string
            itemReorderPoint: string
            itemReorderPointHint: string
            itemReorderQty: string
            itemAliases: string
            itemAliasesHint: string
            itemOpening: string
            itemStop: string
            itemResume: string
        }
        editing: string | null
        active: boolean | null
        values: ItemFormValues
        suppliers: {
            id: string
            label: string
        }[]
        isPending: boolean
        error: string | null
    } | null
    on: {
        field: (name: ItemFormField, value: string) => void
        save: () => void
        toggleActive: () => void
        close: () => void
    }
}

/** Opens, fills and saves the item form; `props` is null while the drawer is closed. */
export const useItemDrawer = (
    suppliers: ReadonlyArray<SupplierView>,
    commands: InventoryCommandSet<"saveItem" | "setItemActive">,
    lifetime?: InventoryPanelScope,
): ItemDrawerView => {
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
                    drawer.finish,
                )
            },
            toggleActive: () => {
                if (item !== null) run.exec(() => commands.setItemActive(item.id, !item.active), drawer.finish)
            },
            close: drawer.close,
        },
    }
}

/** The sentences of the catalog the drawer reads under their own names. */
const ITEM_DRAWER_KEYS = [
    "itemAddTitle",
    "itemDrawerHint",
    "close",
    "itemName",
    "itemSku",
    "itemSkuHint",
    "itemUnit",
    "itemUnitHint",
    "itemUnits",
    "itemUnitsHint",
    "itemCategory",
    "itemSupplier",
    "itemSupplierNone",
    "itemCost",
    "itemSell",
    "itemReorderPoint",
    "itemReorderPointHint",
    "itemReorderQty",
    "itemAliases",
    "itemAliasesHint",
    "itemOpening",
    "save",
    "itemStop",
    "itemResume",
] as const

/** Resolves the exact item drawer copy in its domain owner. */
const itemDrawerCopy = (say: ReturnType<typeof useSay>, owner: ItemView | null) => ({
    ...sayAll(say, ITEM_DRAWER_KEYS),
    itemEditTitle: say("itemEditTitle", { name: owner?.name ?? "" }),
})
