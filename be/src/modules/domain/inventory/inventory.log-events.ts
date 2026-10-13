/** The structured log events of the inventory capability. */
export enum InventoryLogEvent {
    /** Asking the owner to approve a drafted order failed; the draft stays. */
    RequestSendFailed = "inventory.request-send-failed",
    /** Drafted purchase orders after a stock movement. */
    OrdersDrafted = "inventory.orders-drafted",
    /** A member command ended in an error that is not a refusal in words. */
    CommandFailed = "inventory.command-failed",
    /** The stock-out history read failed; the workbench shows an empty figure for it. */
    StockOutsReadFailed = "inventory.stock-outs-read-failed",
}
