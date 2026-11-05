"use client"

import {
    stockDetailOf,
    includesText,
    stockMatchesFilter,
    stepOf,
    useAdjustDrawer,
    useInventoryFormat,
    useInventoryRun,
    useItemDrawer,
    type StockFilter,
} from "@/hooks/inventory"
import {
    buildStockCommands,
    buildStockListView,
    type InventoryStockOn,
    type InventoryStockProps,
} from "@/hooks/inventoryStockView"
import { useFeatureReset } from "@/hooks/reuseables"
import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ItemView } from "@/modules/types"
import { useInventoryCatalogCommands, useInventoryStockCommands } from "@/hooks/inventoryCommands"

/** The view `useInventoryStockView` returns. */
export interface InventoryStockView {
    readonly props: InventoryStockProps
    readonly on: InventoryStockOn
}

/** The stock tab: search and filter live here, the drawers in their hooks, the drawing in the pure half. */
export const useInventoryStockView = (input: InventoryPanelInput): InventoryStockView => {
    const board = input.board
    const lifetime = { isActive: input.isActive, scope: input.scope }
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const run = useInventoryRun(input.isActive, input.scope)
    const commands = { ...useInventoryCatalogCommands(), ...useInventoryStockCommands() }
    const itemDrawer = useItemDrawer(board.suppliers, commands, lifetime)
    const adjustDrawer = useAdjustDrawer(board.locations, board.defaultLocationId, commands, lifetime)
    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState<StockFilter>("all")
    const [showInactive, setShowInactive] = useState(false)
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setQuery("")
            setFilter("all")
            setShowInactive(false)
        },
    })
    const rows = board.items.filter(
        (item) =>
            item.active !== showInactive &&
            stockMatchesFilter(filter, item.status) &&
            includesText(`${item.name} ${item.sku} ${item.category}`, query),
    )
    const detailOf = (item: ItemView) => stockDetailOf(item, { board, format })
    const quick = (id: string, sign: 1 | -1) => {
        const item = board.items.find((entry) => entry.id === id)
        if (item === undefined) return
        run.exec(
            () =>
                commands.adjustStock({
                    itemId: item.id,
                    delta: sign * stepOf(item),
                    reason: t(sign > 0 ? "stockQuickPlus" : "stockQuickMinus"),
                }),
            (result) => (result.state === "waiting" ? t("stockQuickWaiting") : undefined),
        )
    }
    const draft = () =>
        run.exec(
            () => commands.draftLowStock(),
            (result) => (result.drafted > 0 ? t("stockDrafted", { n: result.drafted }) : t("stockDraftedNone")),
        )
    const lowCount = board.metrics.lowCount + board.metrics.outCount
    const empty = board.items.length === 0
    const hasInactive = board.items.some((item) => !item.active)
    return {
        props: buildStockListView({
            t,
            board,
            lowCount,
            empty,
            hasInactive,
            showInactive,
            query,
            filter,
            rows,
            format,
            detailOf,
            run,
            itemDrawer,
            adjustDrawer,
        }),
        on: buildStockCommands({
            setQuery,
            setFilter,
            itemDrawer,
            draft,
            quick,
            board,
            adjustDrawer,
            setShowInactive,
        }),
    }
}
