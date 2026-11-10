import type { DataRight } from "@nivo-lite/agent-sdk/rights"

/** The credits of the workspace with the bank's own reference and the direction, for the daily report and the month-end reconciliation. */
export const READ_CREDITS: DataRight = {
    kind: "bank-transaction",
    access: "read",
    scope: "workspace",
    fields: ["id", "amountVnd", "occurredAt", "orderId", "status", "direction", "externalRef"],
}
