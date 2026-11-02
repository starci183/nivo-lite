import type { ContractImportDialogEvents } from "./contract-import"
import type { DecisionRowActions } from "./sales"
import type { ChatbotInboxActions } from "./chatbot-inbox-actions"
/** Lets a person retry or stop an attention item. */
export interface SalesAttentionActions {
    readonly retry: (key: string, workItemId: string) => void
    readonly stop: (key: string, workItemId: string) => void
}
/** Controls the move dialog and commits a selected deal transition. */
export interface SalesPipelineActions {
    readonly move: (leadId: string) => void
    readonly target: (value: string) => void
    readonly reason: (value: string) => void
    readonly confirm: () => void
    readonly close: () => void
}
/** Edits and submits shipment details or closes the drawer. */
export interface SalesShipmentDrawerActions {
    readonly carrier: (value: string) => void
    readonly tracking: (value: string) => void
    readonly submit: () => void
    readonly close: () => void
}
/** Runs an order handoff and manages the shipment drawer. */
export interface SalesHandoffsActions {
    readonly run: (key: string, orderId: string) => void
    readonly ship: (key: string) => void
    readonly carrier: (value: string) => void
    readonly tracking: (value: string) => void
    readonly submit: () => void
    readonly close: () => void
}
/** Edits shared contract fields and submits or closes the editor. */
export interface SalesContractCommonActions {
    readonly lead: (value: string) => void
    readonly customer: (value: string) => void
    readonly plan: (value: string) => void
    readonly amount: (value: string) => void
    readonly status: (value: string) => void
    readonly note: (value: string) => void
    readonly submit: () => void
    readonly close: () => void
}
/** Adds contract date editing to the shared editor actions. */
export interface SalesContractEditorActions extends SalesContractCommonActions {
    readonly start: (value: string) => void
    readonly end: (value: string) => void
}
/** Controls contract rows, the editor, and the import dialog. */
export interface SalesContractsActions {
    readonly retry: () => void
    readonly add: () => void
    readonly openImport: () => void
    readonly edit: (contractId: string) => void
    readonly drawer: SalesContractEditorActions
    /** Files retain the existing native FileDropzone intake ABI, never part of read data. */
    readonly import: ContractImportDialogEvents
}
/** The real interactions between the connected Sales owner and its pure Base. */
export interface SalesWorkbenchActions {
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retry: () => void
    readonly waiting: { readonly command: (rowId: string, commandId: string) => void; readonly retry: () => void }
    readonly attention: SalesAttentionActions
    readonly pipeline: SalesPipelineActions
    readonly decisions: DecisionRowActions
    readonly handoffs: SalesHandoffsActions
    readonly orders: { readonly loadMore: () => void; readonly retry: () => void }
    readonly contracts: SalesContractsActions
    readonly inbox: ChatbotInboxActions & { readonly reload: () => void }
}
