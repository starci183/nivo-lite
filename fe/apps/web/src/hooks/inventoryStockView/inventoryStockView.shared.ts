import {
    stockToggleLabel,
    STOCK_FILTERS,
    STOCK_TONES,
    openById,
    stepOf,
    type useAdjustDrawer,
    type useInventoryFormat,
    type useInventoryRun,
    type useItemDrawer,
    type StockFilter,
    type ItemFormField,
    type ItemDrawerView,
    type AdjustDrawerView,
} from "@/hooks/inventory"
import type { InventoryWorkbenchData, ItemView } from "@/modules/types"
import type { useTranslations } from "next-intl"
import type { Dispatch, SetStateAction } from "react"

/** Inputs needed to build the props of the stock tab. */
export interface BuildStockListViewContext {
    readonly t: ReturnType<typeof useTranslations<"workbenchInventory">>
    readonly board: InventoryWorkbenchData
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

/** Inputs needed to build the commands of the stock tab. */
export interface BuildStockCommandsContext {
    readonly setQuery: Dispatch<SetStateAction<string>>
    readonly setFilter: Dispatch<SetStateAction<StockFilter>>
    readonly itemDrawer: ReturnType<typeof useItemDrawer>
    readonly draft: () => void
    readonly quick: (id: string, sign: 1 | -1) => void
    readonly board: InventoryWorkbenchData
    readonly adjustDrawer: ReturnType<typeof useAdjustDrawer>
    readonly setShowInactive: Dispatch<SetStateAction<boolean>>
}

const filterOf = (value: string): StockFilter => STOCK_FILTERS.find((filter) => filter === value) ?? "all"

/** The props of the stock tab. */
export interface InventoryStockProps {
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly addLabel: string | null
    readonly draftLabel: string | null
    readonly filterLabel: string
    readonly filters: {
        value: StockFilter
        label: string
    }[]
    readonly listLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly adjustLabel: string
    readonly editLabel: string | null
    readonly toggleInactiveLabel: string | null
    readonly query: string
    readonly filter: StockFilter
    readonly rows: {
        id: string
        name: string
        statusLabel: string
        statusTone: "success" | "neutral" | "danger" | "warning"
        onOrderLabel: string | null
        detail: string
        total: string
        stepLabel: string
        lessLabel: string
        moreLabel: string
    }[]
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
    readonly itemDrawer: ItemDrawerView["props"]
    readonly adjustDrawer: AdjustDrawerView["props"]
}

/** The commands of the stock tab. */
export interface InventoryStockOn {
    readonly onQuery: (value: string) => void
    readonly onFilter: (value: string) => void
    readonly onAdd: () => void
    readonly onDraft: () => void
    readonly onQuick: (id: string, sign: 1 | -1) => void
    readonly onAdjust: (id: string) => void
    readonly onEdit: (id: string) => void
    readonly onToggleInactive: () => void
    readonly onItemField: (name: ItemFormField, value: string) => void
    readonly onItemSave: () => void
    readonly onItemToggle: () => void
    readonly onItemClose: () => void
    readonly onAdjustMode: (next: string) => void
    readonly onAdjustFrom: (from: string) => void
    readonly onAdjustTo: (to: string) => void
    readonly onAdjustValue: (value: string) => void
    readonly onAdjustReason: (reason: string) => void
    readonly onAdjustSubmit: () => void
    readonly onAdjustClose: () => void
}

/** Builds the InventoryStockContent section from the current view. */
export const buildStockListView = (c: BuildStockListViewContext): InventoryStockProps => ({
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
})

/** Builds the InventoryStockContent section from the current view. */
export const buildStockCommands = (c: BuildStockCommandsContext): InventoryStockOn => ({
    onQuery: (value: string) => c.setQuery(value),
    onFilter: (value: string) => c.setFilter(filterOf(value)),
    onAdd: () => c.itemDrawer.open(null),
    onDraft: c.draft,
    onQuick: c.quick,
    onAdjust: openById(c.board.items, c.adjustDrawer.open),
    onEdit: openById(c.board.items, c.itemDrawer.open),
    onToggleInactive: () => c.setShowInactive((current) => !current),
    onItemField: c.itemDrawer.on.field,
    onItemSave: c.itemDrawer.on.save,
    onItemToggle: c.itemDrawer.on.toggleActive,
    onItemClose: c.itemDrawer.on.close,
    onAdjustMode: c.adjustDrawer.on.mode,
    onAdjustFrom: c.adjustDrawer.on.from,
    onAdjustTo: c.adjustDrawer.on.to,
    onAdjustValue: c.adjustDrawer.on.value,
    onAdjustReason: c.adjustDrawer.on.reason,
    onAdjustSubmit: c.adjustDrawer.on.submit,
    onAdjustClose: c.adjustDrawer.on.close,
})
