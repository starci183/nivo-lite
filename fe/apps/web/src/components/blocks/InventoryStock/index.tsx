"use client"

import type { StockDetailContext } from "./component"
import type { BuildStockListViewContext, BuildStockCommandsContext } from "./component"
import { useInventoryBoard } from "@/hooks/inventoryBoard"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
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
} from "@/hooks/inventory"
import type { StockFilter } from "@/hooks/inventory"
import type { ItemView } from "@/modules/types"
import { useInventoryCatalogCommands, useInventoryStockCommands } from "@/hooks/inventoryCommands"
import { InventoryStockBase } from "./component"

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
const buildStockListView = ({
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
}: BuildStockListViewContext) =>
    ({
        searchLabel: t("stockSearch"),
        searchPlaceholder: t("stockSearchHint"),
        clearLabel: t("clearSearch"),
        addLabel: board.canManage ? t("stockAdd") : null,
        draftLabel: board.canManage && lowCount > 0 ? t("stockDraft") : null,
        filterLabel: t("stockFilter"),
        filters: STOCK_FILTERS.map((value) => ({ value, label: t(`filter_${value}`) })),
        listLabel: t("stockList"),
        emptyTitle: t(empty ? "stockEmptyTitle" : "stockNoMatchTitle"),
        emptyBody: t(empty ? "stockEmptyBody" : "stockNoMatchBody"),
        adjustLabel: t("stockAdjust"),
        editLabel: board.canManage ? t("edit") : null,
        toggleInactiveLabel:
            board.canManage && hasInactive ? t(showInactive ? "stockShowActive" : "stockShowInactive") : null,
        query,
        filter,
        rows: rows.map((item) => ({
            id: item.id,
            name: item.name,
            statusLabel: t(`stock_${item.status}`),
            statusTone: STOCK_TONES[item.status],
            onOrderLabel:
                item.onOrder > 0 ? t("stockOnOrder", { qty: format.qty(item.onOrder), unit: item.unit }) : null,
            detail: detailOf(item),
            total: `${format.qty(item.total)} ${item.unit}`,
            stepLabel: format.qty(stepOf(item)),
            lessLabel: t("stockLess", { qty: format.qty(stepOf(item)), unit: item.unit, name: item.name }),
            moreLabel: t("stockMore", { qty: format.qty(stepOf(item)), unit: item.unit, name: item.name }),
        })),
        isPending: run.isPending,
        error: run.error,
        notice: run.notice,
        itemDrawer: itemDrawer.props,
        adjustDrawer: adjustDrawer.props,
    }) as const
/** Builds the InventoryStockContent section from the current view. */
const buildStockCommands = ({
    setQuery,
    setFilter,
    itemDrawer,
    draft,
    quick,
    board,
    adjustDrawer,
    setShowInactive,
}: BuildStockCommandsContext) =>
    ({
        query: setQuery,
        filter: (value: string) => setFilter(filterOf(value)),
        add: () => itemDrawer.open(null),
        draft,
        quick,
        adjust: openById(board.items, adjustDrawer.open),
        edit: openById(board.items, itemDrawer.open),
        toggleInactive: () => setShowInactive((current) => !current),
        itemField: itemDrawer.on.field,
        itemSave: itemDrawer.on.save,
        itemToggle: itemDrawer.on.toggleActive,
        itemClose: itemDrawer.on.close,
        adjustMode: adjustDrawer.on.mode,
        adjustFrom: adjustDrawer.on.from,
        adjustTo: adjustDrawer.on.to,
        adjustValue: adjustDrawer.on.value,
        adjustReason: adjustDrawer.on.reason,
        adjustSubmit: adjustDrawer.on.submit,
        adjustClose: adjustDrawer.on.close,
    }) as const

/** Item identity, supplier, location totals and replenishment details. */
const stockDetailOf = (item: ItemView, { board, format, t }: StockDetailContext): string => {
    const placeName = (id: string): string => board.locations.find((location) => location.id === id)?.name ?? ""
    return [
        item.sku,
        item.category,
        board.suppliers.find((supplier) => supplier.id === item.supplierId)?.name ?? "",
        board.locations.length > 1
            ? item.levels.map((level) => `${placeName(level.locationId)} ${format.qty(level.qty)}`).join(", ")
            : "",
        item.reorderPoint > 0 ? t("stockMin", { qty: format.qty(item.reorderPoint) }) : "",
        item.costVnd > 0 ? t("stockCost", { cost: format.money(item.costVnd), unit: item.unit }) : "",
    ]
        .filter((part) => part !== "")
        .join(" · ")
}
