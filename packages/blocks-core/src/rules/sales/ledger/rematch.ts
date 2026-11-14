import type { OrderRecord, TransactionRecord } from "./accounting.types"
import { AWAITING_PAYMENT } from "./settle"

const DAY_MS = 86_400_000

/** The point in time a re-match looks back to: `days` days before `now`, ISO text. */
export const sinceOf = (now: string, days: number): string => new Date(Date.parse(now) - days * DAY_MS).toISOString()

/** A transfer text as the bank may write it, upper case with only letters and digits kept (`dh-2026 1106` is `DH20261106`). */
const compactOf = (text: string | null | undefined): string =>
    (text ?? "")
        .normalize("NFKD")
        .toUpperCase()
        .replaceAll(/[^A-Z0-9]/g, "")

/**
 * The credits that name the payment code of an order which just received it: money in, still unmatched, whose transfer content holds the
 * order number (as `compactOf` reads both). Whatever their amount: what a credit pays is decided by the reconciliation workflow, never
 * here. None for an order that no longer waits for money.
 */
export const creditsNamingCode = (
    order: OrderRecord,
    credits: ReadonlyArray<TransactionRecord>,
): ReadonlyArray<TransactionRecord> => {
    const code = compactOf(order.orderNo)
    if (code === "" || !AWAITING_PAYMENT.includes(order.status)) return []
    return credits.filter(
        (credit) => credit.direction === "credit" && credit.status === "unmatched" && compactOf(credit.reference).includes(code),
    )
}
