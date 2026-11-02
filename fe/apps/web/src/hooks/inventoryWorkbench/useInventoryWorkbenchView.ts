"use client"
import { INVENTORY_TABS } from "@/modules/types"
import { useAppSelector } from "@/redux"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { EMPTY_INVENTORY_BOARD } from "@/hooks/inventoryBoard"
import { mapSlot, slotOfReads, useSlotLabels } from "@/hooks/slot"
import { useInventoryWorkbenchData } from "./useInventoryWorkbenchData"
import { useInventoryFiguresView } from "./useInventoryFiguresView"
import { useInventoryStockView } from "./useInventoryStockView"
import { useInventoryOrdersView } from "./useInventoryOrdersView"
import { useInventoryPendingView } from "./useInventoryPendingView"
import { useInventorySuppliersView } from "./useInventorySuppliersView"
import { useInventoryHistoryView } from "./useInventoryHistoryView"
import { useInventoryRecipesView } from "./useInventoryRecipesView"
import { useInventoryCountView } from "./useInventoryCountView"
import { useInventoryImportView } from "./useInventoryImportView"

type InventoryTab = (typeof INVENTORY_TABS)[number]
/** The server-resolved installation, deep link and all seven original tab labels. */
interface InventoryWorkbenchInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<InventoryTab, string>>
}
/** Owns inventory read scopes, independent common regions and the actual conditional tab lifetimes. */
export const useInventoryWorkbenchView = (input: InventoryWorkbenchInput) => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const scope = JSON.stringify([workspaceId ?? null, input.installationId])
    const tabs = useAgentWorkbenchTabs({ ids: INVENTORY_TABS, initialTab: input.initialTab })
    const frame = useAgentDashboardFrame({
        module: "inventory",
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const overview = frame.why.workItemId === null
    const data = useInventoryWorkbenchData(overview),
        board = data.data ?? EMPTY_INVENTORY_BOARD
    const of = (id: InventoryTab) => ({ board, isActive: overview && tabs.selected === id, scope })
    const figures = useInventoryFiguresView(of(tabs.selected))
    const stock = useInventoryStockView(of("stock")),
        orders = useInventoryOrdersView(of("orders")),
        pending = useInventoryPendingView(of("orders"))
    const suppliers = useInventorySuppliersView(of("suppliers")),
        history = useInventoryHistoryView(of("history")),
        recipes = useInventoryRecipesView(of("recipes"))
    const count = useInventoryCountView(of("count")),
        imports = useInventoryImportView(of("import"))
    const labels = useSlotLabels()
    const panel = {
        stock: stock.props,
        orders: orders.props,
        pending: pending.props,
        suppliers: suppliers.props,
        history: history.props,
        recipes: recipes.props,
        count: count.props,
    }
    const slotLabels = labels(input.tabs[tabs.selected])
    return {
        shape: overview ? tabs.selected : ("explanation" as const),
        props: {
            why: frame.why,
            regions: frame.regions,
            tabsLabel: frame.tabsLabel,
            selectedTab: tabs.selected,
            tabs: INVENTORY_TABS.map((id) => ({ id, label: input.tabs[id] })),
            ribbon: {
                label: figures.label,
                slot: mapSlot(data.slot, () => figures.items),
                placeholder: figures.items,
                labels: slotLabels,
            },
            panel: { slot: mapSlot(data.slot, () => panel), placeholder: panel, labels: slotLabels },
            importPanel: {
                slot: slotOfReads([data.read, imports.templateRead], () => imports.props),
                placeholder: imports.props,
                labels: slotLabels,
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retryPanel: data.reload,
            retryImport: () => Promise.all([data.reload(), imports.retryTemplates()]),
            stock: stock.on,
            orders: orders.on,
            pending: pending.on,
            suppliers: suppliers.on,
            history: history.on,
            recipes: recipes.on,
            count: count.on,
            imports: imports.on,
        },
    } as const
}
