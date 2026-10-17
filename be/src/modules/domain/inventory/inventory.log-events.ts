/** The structured log events of the inventory capability. */
export enum InventoryLogEvent {
    /** Asking the owner to approve a drafted order failed; the draft stays. */
    RequestSendFailed = "inventory.request-send-failed",
    /** The stock-out history read failed; the workbench shows an empty figure for it. */
    StockOutsReadFailed = "inventory.stock-outs-read-failed",
}
