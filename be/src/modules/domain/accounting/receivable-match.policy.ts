import type { ReceivableMatch, ReceivableSnapshot } from "./accounting-gateway.port"

/**
 * How a payment credit stands against the receivable the connector found: `exact` when it pays the balance due, `partial` below
 * it, `over` above it, `settled` when nothing is due. Only `exact` is recorded without a person.
 */
export const matchReceivable = (receivable: ReceivableSnapshot, amountVnd: number): ReceivableMatch => {
    if (receivable.balanceVnd <= 0) return "settled"
    if (amountVnd === receivable.balanceVnd) return "exact"
    return amountVnd < receivable.balanceVnd ? "partial" : "over"
}
