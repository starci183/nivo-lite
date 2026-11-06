"use client"
import { INVENTORY_TABS, type DataSlot, type SlotLabels } from "@/modules/types"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"
import { useAgentWorkbenchShell, type AgentWorkbenchFrame } from "@/hooks/agentDashboard"
import { EMPTY_INVENTORY_BOARD } from "./inventoryWorkbench.shared"
import { mapSlot, slotOfReads, useSlotLabels } from "@/hooks/slot"
import { useInventoryWorkbenchData, type InventoryWorkbenchDataViewShape } from "./useInventoryWorkbenchData"
import { useInventoryFiguresView } from "./useInventoryFiguresView"
import { useInventoryStockView, type InventoryStockView } from "./useInventoryStockView"
import { useInventoryOrdersView, type InventoryOrdersView } from "./useInventoryOrdersView"
import { useInventoryPendingView, type InventoryPendingView } from "./useInventoryPendingView"
import { useInventorySuppliersView, type InventorySuppliersView } from "./useInventorySuppliersView"
import { useInventoryHistoryView, type InventoryHistoryView } from "./useInventoryHistoryView"
import { useInventoryRecipesView, type InventoryRecipesView } from "./useInventoryRecipesView"
import { useInventoryCountView, type InventoryCountView } from "./useInventoryCountView"
import { useInventoryImportView, type InventoryImportView } from "./useInventoryImportView"
import type { Figure } from "@starci/grammar/common"

type InventoryTab = (typeof INVENTORY_TABS)[number]
/** The server-resolved installation, deep link and all seven original tab labels. */
interface InventoryWorkbenchInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<InventoryTab, string>>
}

/** The props of the seven panels, each as the hook that owns it draws them. */
export interface InventoryPanelProps {
    readonly stock: InventoryStockView["props"]
    readonly orders: InventoryOrdersView["props"]
    readonly pending: InventoryPendingView["props"]
    readonly suppliers: InventorySuppliersView["props"]
    readonly history: InventoryHistoryView["props"]
    readonly recipes: InventoryRecipesView["props"]
    readonly count: InventoryCountView["props"]
}

/** The props of the workbench: the frame, the ribbon, the panels and the import panel. */
export interface InventoryWorkbenchProps extends AgentWorkbenchFrame<InventoryTab> {
    readonly ribbon: {
        readonly label: string
        readonly slot: DataSlot<readonly Figure[]>
        readonly placeholder: readonly Figure[]
        readonly labels: SlotLabels
    }
    readonly panel: {
        readonly slot: DataSlot<InventoryPanelProps>
        readonly placeholder: InventoryPanelProps
        readonly labels: SlotLabels
    }
    readonly importPanel: {
        readonly slot: DataSlot<InventoryImportView["props"]>
        readonly placeholder: InventoryImportView["props"]
        readonly labels: SlotLabels
    }
}

/** The commands of the workbench: the tab and the retries, then those of each panel. */
export interface InventoryWorkbenchOn {
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retryPanel: InventoryWorkbenchDataViewShape["reload"]
    readonly retryImport: () => Promise<unknown>
    readonly stock: InventoryStockView["on"]
    readonly orders: InventoryOrdersView["on"]
    readonly pending: InventoryPendingView["on"]
    readonly suppliers: InventorySuppliersView["on"]
    readonly history: InventoryHistoryView["on"]
    readonly recipes: InventoryRecipesView["on"]
    readonly count: InventoryCountView["on"]
    readonly imports: InventoryImportView["on"]
}

/** The view `useInventoryWorkbenchView` returns. */
export interface InventoryWorkbenchView {
    readonly shape: "explanation" | "history" | "count" | "orders" | "import" | "suppliers" | "recipes" | "stock"
    readonly props: InventoryWorkbenchProps
    readonly on: InventoryWorkbenchOn
}

/** Owns inventory read scopes, independent common regions and the actual conditional tab lifetimes. */
export const useInventoryWorkbenchView = (input: InventoryWorkbenchInput): InventoryWorkbenchView => {
    const workspaceId = useOpenWorkspaceId()
    const scope = JSON.stringify([workspaceId ?? null, input.installationId])
    const {
        tabs,
        dashboard: frame,
        isNormal: overview,
        frameOf,
    } = useAgentWorkbenchShell({
        module: "inventory",
        installationId: input.installationId,
        ids: INVENTORY_TABS,
        initialTab: input.initialTab,
    })
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
            ...frameOf(input.tabs),
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
