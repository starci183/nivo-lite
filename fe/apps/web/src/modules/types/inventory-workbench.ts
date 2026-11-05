import type { BadgeTone } from "@starci/grammar/common"
import type { SupplierFormField, InventoryTemplateChoice, PoStatus } from "./inventory"
import type {
    InventoryItemFormData,
    InventoryItemEditorData,
    InventoryAdjustmentEditorData,
    InventoryNewPoEditorData,
    InventoryPoEditorData,
    InventorySupplierEditorData,
    InventoryRecipeEditorData,
} from "./inventory-editors"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView, WorkbenchFigureRegion } from "./workbench-dashboard"
import type { SlotPanelProps } from "./slot"
/** InventoryStockData resolved data. */
export interface InventoryStockData {
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly filterLabel: string
    readonly listLabel: string
    readonly columns: {
        readonly item: string
        readonly onHand: string
        readonly minimum: string
        readonly status: string
        readonly cost: string
    }
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly adjustLabel: string
    readonly query: string
    readonly filter: string
    readonly addLabel: string | null
    readonly draftLabel: string | null
    readonly editLabel: string | null
    readonly toggleInactiveLabel: string | null
    readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly statusLabel: string
        readonly statusTone: BadgeTone
        readonly onOrderLabel: string | null
        readonly identity: string
        readonly minimum: string
        readonly cost: string
        readonly total: string
        readonly stepLabel: string
        readonly lessLabel: string
        readonly moreLabel: string
    }>
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
    readonly itemDrawer: InventoryItemEditorData | null
    readonly adjustDrawer: InventoryAdjustmentEditorData | null
}
/** InventoryOrdersData resolved data. */
export interface InventoryOrdersData {
    readonly createLabel: string | null
    readonly openCount: string
    readonly boardLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly openLabel: string
    readonly hasOrders: boolean
    readonly lanes: ReadonlyArray<{
        readonly status: PoStatus
        readonly label: string
        readonly count: string
        readonly cards: ReadonlyArray<{
            readonly id: string
            readonly poNo: string
            readonly statusLabel: string
            readonly statusTone: BadgeTone
            readonly supplier: string
            readonly facts: string
            readonly copyNote: string | null
        }>
    }>
    readonly poDrawer: InventoryPoEditorData | null
    readonly newPoDrawer: InventoryNewPoEditorData | null
}
/** InventoryPendingData resolved data. */
export interface InventoryPendingData {
    readonly title: string
    readonly description: string
    readonly rejectLabel: string
    readonly count: number
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly summary: string
        readonly draft: string | null
        readonly approveLabel: string
    }>
    readonly isPending: boolean
    readonly error: string | null
}
/** InventorySuppliersData resolved data. */
export interface InventorySuppliersData {
    readonly addLabel: string | null
    readonly editLabel: string | null
    readonly listLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly locationsTitle: string
    readonly locationsText: string
    readonly locationLabel: string
    readonly locationAddLabel: string
    readonly locationName: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly channelLabel: string
        readonly detail: string
        readonly itemsText: string
    }>
    readonly canAddLocation: boolean
    readonly isPending: boolean
    readonly error: string | null
    readonly drawer: InventorySupplierEditorData | null
}
/** InventoryRecipesData resolved data. */
export interface InventoryRecipesData {
    readonly addLabel: string | null
    readonly editLabel: string | null
    readonly addDisabled: boolean
    readonly listLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
    readonly drawer: InventoryRecipeEditorData | null
}
/** InventoryHistoryData resolved data. */
export interface InventoryHistoryData {
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly kindLabel: string
    readonly listLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly query: string
    readonly kind: string
    readonly kinds: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly kindLabel: string
        readonly kindTone: BadgeTone
        readonly itemName: string
        readonly quantity: string
        readonly detail: string
        readonly evidence: string | null
        readonly stamp: string
    }>
}
/** InventoryCountData resolved data. */
export interface InventoryCountData {
    readonly intro: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly listLabel: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly submitLabel: string
    readonly query: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly machine: string
        readonly fieldLabel: string
        readonly unit: string
        readonly value: string
    }>
    readonly canSubmit: boolean
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
}
/** InventoryImportData resolved data. */
export interface InventoryImportData {
    readonly allowed: boolean
    readonly deniedTitle: string
    readonly deniedBody: string
    readonly pasteTitle: string
    readonly pasteHelp: string
    readonly pasteLabel: string
    readonly pastePlaceholder: string
    readonly pasteSubmit: string
    readonly text: string
    readonly startTitle: string
    readonly startFooter: string
    readonly loadLabel: string
    readonly templates: ReadonlyArray<InventoryTemplateChoice>
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
}
/** InventoryPanelsData resolved data. */
export interface InventoryPanelsData {
    readonly stock: InventoryStockData
    readonly orders: InventoryOrdersData
    readonly pending: InventoryPendingData
    readonly suppliers: InventorySuppliersData
    readonly history: InventoryHistoryData
    readonly recipes: InventoryRecipesData
    readonly count: InventoryCountData
}
/** InventoryWorkbenchDataView resolved data. */
export interface InventoryWorkbenchDataView {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly ribbon: WorkbenchFigureRegion
    readonly panel: SlotPanelProps<InventoryPanelsData>
    readonly importPanel: SlotPanelProps<InventoryImportData>
}
/** InventoryStockActions resolved data. */
export interface InventoryStockActions {
    readonly onQuery: (value: string) => void
    readonly onFilter: (value: string) => void
    readonly onAdd: () => void
    readonly onDraft: () => void
    readonly onQuick: (id: string, sign: 1 | -1) => void
    readonly onAdjust: (id: string) => void
    readonly onEdit: (id: string) => void
    readonly onToggleInactive: () => void
    readonly onItemField: (name: keyof InventoryItemFormData, value: string) => void
    readonly onItemSave: () => void
    readonly onItemToggle: () => void
    readonly onItemClose: () => void
    readonly onAdjustMode: (value: string) => void
    readonly onAdjustFrom: (value: string) => void
    readonly onAdjustTo: (value: string) => void
    readonly onAdjustValue: (value: string) => void
    readonly onAdjustReason: (value: string) => void
    readonly onAdjustSubmit: () => void
    readonly onAdjustClose: () => void
}
/** InventoryOrdersActions resolved data. */
export interface InventoryOrdersActions {
    readonly onCreate: () => void
    readonly onOpen: (id: string) => void
    readonly onPoSupplier: (value: string) => void
    readonly onPoExpected: (value: string) => void
    readonly onPoLine: (index: number, field: "qty" | "cost", value: string) => void
    readonly onPoInvoice: (value: string) => void
    readonly onPoMessage: (value: string) => void
    readonly onPoSaveDraft: () => void
    readonly onPoSendForApproval: () => void
    readonly onPoApprove: () => void
    readonly onPoReject: () => void
    readonly onPoReceive: () => void
    readonly onPoRemind: () => void
    readonly onPoCopy: () => void
    readonly onPoCancel: () => void
    readonly onPoClose: () => void
    readonly onNewSupplier: (value: string) => void
    readonly onNewPick: (index: number, itemId: string) => void
    readonly onNewQty: (index: number, value: string) => void
    readonly onNewCost: (index: number, value: string) => void
    readonly onNewAddLine: () => void
    readonly onNewCreate: () => void
    readonly onNewClose: () => void
}
/** InventorySuppliersActions resolved data. */
export interface InventorySuppliersActions {
    readonly onAdd: () => void
    readonly onEdit: (id: string) => void
    readonly onLocationName: (value: string) => void
    readonly onAddLocation: () => void
    readonly onSupplierField: (name: SupplierFormField, value: string) => void
    readonly onSupplierSave: () => void
    readonly onSupplierClose: () => void
}
/** InventoryRecipesActions resolved data. */
export interface InventoryRecipesActions {
    readonly onAdd: () => void
    readonly onEdit: (id: string) => void
    readonly onRecipeName: (value: string) => void
    readonly onRecipeAliases: (value: string) => void
    readonly onRecipeItem: (index: number, itemId: string) => void
    readonly onRecipeQty: (index: number, value: string) => void
    readonly onRecipeRemoveLine: (index: number) => void
    readonly onRecipeAddLine: () => void
    readonly onRecipeSave: () => void
    readonly onRecipeRemove: () => void
    readonly onRecipeClose: () => void
}
/** InventoryWorkbenchActions resolved data. */
export interface InventoryWorkbenchActions {
    readonly selectTab: (key: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retryPanel: () => void
    readonly retryImport: () => void
    readonly stock: InventoryStockActions
    readonly orders: InventoryOrdersActions
    readonly suppliers: InventorySuppliersActions
    readonly recipes: InventoryRecipesActions
    readonly pending: { readonly onApprove: (id: string) => void; readonly onReject: (id: string) => void }
    readonly history: { readonly onQuery: (value: string) => void; readonly onKind: (value: string) => void }
    readonly count: {
        readonly onQuery: (value: string) => void
        readonly onCount: (id: string, value: string) => void
        readonly onSubmit: () => void
    }
    readonly imports: {
        readonly onText: (value: string) => void
        readonly onPaste: () => void
        readonly onLoad: (key: string) => void
    }
}
/** InventoryPendingActions resolved data. */
export interface InventoryPendingActions {
    readonly onApprove: (id: string) => void
    readonly onReject: (id: string) => void
}
/** InventoryHistoryActions resolved data. */
export interface InventoryHistoryActions {
    readonly onQuery: (value: string) => void
    readonly onKind: (value: string) => void
}
/** InventoryCountActions resolved data. */
export interface InventoryCountActions {
    readonly onQuery: (value: string) => void
    readonly onCount: (id: string, value: string) => void
    readonly onSubmit: () => void
}
/** InventoryImportActions resolved data. */
export interface InventoryImportActions {
    readonly onText: (value: string) => void
    readonly onPaste: () => void
    readonly onLoad: (key: string) => void
}

/** The original workbench areas in route and display order. */
export const INVENTORY_TABS = ["stock", "orders", "suppliers", "history", "recipes", "count", "import"] as const
