"use client"

import { InventoryStockBase } from "./component"

import { useInventoryBoard } from "@/hooks/inventoryBoard"
import { useTranslations } from "next-intl"
import { useState, type Dispatch, type SetStateAction } from "react"
import {
    stockDetailOf,
    STOCK_FILTERS,
    STOCK_TONES,
    includesText,
    openById,
    stockMatchesFilter,
    stepOf,
    useAdjustDrawer,
    useInventoryFormat,
    useInventoryRun,
    useItemDrawer,
    type StockFilter,
} from "@/hooks/inventory"

import type { ItemView } from "@/modules/types"
import { useInventoryCatalogCommands, useInventoryStockCommands } from "@/hooks/inventoryCommands"

/** Inputs needed to build the InventoryStockContent section. */
interface BuildStockListViewContext {
    readonly t: ReturnType<typeof useTranslations<"workbenchInventory">>
    readonly board: ReturnType<typeof useInventoryBoard>
    readonly lowCount: number
    readonly empty: boolean
    readonly hasInactive: boolean
    readonly showInactive: boolean
    readonly query: string
    readonly filter: StockFilter
    readonly rows: ItemView[]
    readonly format: ReturnType<typeof useInventoryFormat>
    readonly detailOf: (item: ItemView) => string
    readonly run: ReturnType<typeof useInventoryRun>
    readonly itemDrawer: ReturnType<typeof useItemDrawer>
    readonly adjustDrawer: ReturnType<typeof useAdjustDrawer>
}

/** Inputs needed to build the InventoryStockContent section. */
interface BuildStockCommandsContext {
    readonly setQuery: Dispatch<SetStateAction<string>>
    readonly setFilter: Dispatch<SetStateAction<StockFilter>>
    readonly itemDrawer: ReturnType<typeof useItemDrawer>
    readonly draft: () => void
    readonly quick: (id: string, sign: 1 | -1) => void
    readonly board: ReturnType<typeof useInventoryBoard>
    readonly adjustDrawer: ReturnType<typeof useAdjustDrawer>
    readonly setShowInactive: Dispatch<SetStateAction<boolean>>
}

const filterOf = (value: string): StockFilter => STOCK_FILTERS.find((filter) => filter === value) ?? "all"

/** The stock tab: search and filter live here, the drawers in their hooks, the drawing in the pure half. */
export const InventoryStock = () => {
    const board = useInventoryBoard()
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const run = useInventoryRun()
    const commands = { ...useInventoryCatalogCommands(), ...useInventoryStockCommands() }
    const itemDrawer = useItemDrawer(board.suppliers, commands)
    const adjustDrawer = useAdjustDrawer(board.locations, board.defaultLocationId, commands)
    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState<StockFilter>("all")
    const [showInactive, setShowInactive] = useState(false)
    const rows = board.items.filter(
        (item) =>
            item.active !== showInactive &&
            stockMatchesFilter(filter, item.status) &&
            includesText(`${item.name} ${item.sku} ${item.category}`, query),
    )
    const detailOf = (item: ItemView): string => stockDetailOf(item, { board, format, t })
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
    return (
        <InventoryStockBase
            props={buildStockListView({
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
            })}
            on={buildStockCommands({
                setQuery,
                setFilter,
                itemDrawer,
                draft,
                quick,
                board,
                adjustDrawer,
                setShowInactive,
            })}
        />
    )
}
/** Builds the InventoryStockContent section from the current view. */
const buildStockListView = (c: BuildStockListViewContext) =>
    ({
        searchLabel: c.t("stockSearch"),
        searchPlaceholder: c.t("stockSearchHint"),
        clearLabel: c.t("clearSearch"),
        addLabel: c.board.canManage ? c.t("stockAdd") : null,
        draftLabel: c.board.canManage && c.lowCount > 0 ? c.t("stockDraft") : null,
        filterLabel: c.t("stockFilter"),
        filters: STOCK_FILTERS.map((value) => ({ value, label: c.t(`filter_${value}`) })),
        listLabel: c.t("stockList"),
        emptyTitle: c.t(c.empty ? "stockEmptyTitle" : "stockNoMatchTitle"),
        emptyBody: c.t(c.empty ? "stockEmptyBody" : "stockNoMatchBody"),
        adjustLabel: c.t("stockAdjust"),
        editLabel: c.board.canManage ? c.t("edit") : null,
        toggleInactiveLabel: stockToggleLabel(c.t, c.board.canManage && c.hasInactive, c.showInactive),
        query: c.query,
        filter: c.filter,
        rows: c.rows.map((item) => ({
            id: item.id,
            name: item.name,
            statusLabel: c.t(`stock_${item.status}`),
            statusTone: STOCK_TONES[item.status],
            onOrderLabel:
                item.onOrder > 0 ? c.t("stockOnOrder", { qty: c.format.qty(item.onOrder), unit: item.unit }) : null,
            detail: c.detailOf(item),
            total: `${c.format.qty(item.total)} ${item.unit}`,
            stepLabel: c.format.qty(stepOf(item)),
            lessLabel: c.t("stockLess", { qty: c.format.qty(stepOf(item)), unit: item.unit, name: item.name }),
            moreLabel: c.t("stockMore", { qty: c.format.qty(stepOf(item)), unit: item.unit, name: item.name }),
        })),
        isPending: c.run.isPending,
        error: c.run.error,
        notice: c.run.notice,
        itemDrawer: c.itemDrawer.props,
        adjustDrawer: c.adjustDrawer.props,
    }) as const
/** Builds the InventoryStockContent section from the current view. */
const buildStockCommands = (c: BuildStockCommandsContext) =>
    ({
        query: c.setQuery,
        filter: (value: string) => c.setFilter(filterOf(value)),
        add: () => c.itemDrawer.open(null),
        draft: c.draft,
        quick: c.quick,
        adjust: openById(c.board.items, c.adjustDrawer.open),
        edit: openById(c.board.items, c.itemDrawer.open),
        toggleInactive: () => c.setShowInactive((current) => !current),
        itemField: c.itemDrawer.on.field,
        itemSave: c.itemDrawer.on.save,
        itemToggle: c.itemDrawer.on.toggleActive,
        itemClose: c.itemDrawer.on.close,
        adjustMode: c.adjustDrawer.on.mode,
        adjustFrom: c.adjustDrawer.on.from,
        adjustTo: c.adjustDrawer.on.to,
        adjustValue: c.adjustDrawer.on.value,
        adjustReason: c.adjustDrawer.on.reason,
        adjustSubmit: c.adjustDrawer.on.submit,
        adjustClose: c.adjustDrawer.on.close,
    }) as const

/** Resolves the inactive catalogue toggle only when it is available. */
const stockToggleLabel = (t: BuildStockListViewContext["t"], isAvailable: boolean, showInactive: boolean) => {
    if (!isAvailable) return null
    return t(showInactive ? "stockShowActive" : "stockShowInactive")
}
