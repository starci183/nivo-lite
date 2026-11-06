import type { SepayTransaction } from "@modules/integrations/sepay"
import type { BankTransaction, PolledCredit } from "@modules/domain/provider-registry"

/** The bank name shown when SePay lists none. */
const FALLBACK_BANK = "SePay"

/**
 * Maps one listed SePay transaction to the credit the webhook would have delivered for it: the delivery key and the event id are the
 * webhook's (`<connection>:sepay:<id>` and `sepay:<id>`), so the transaction is one inbox row whichever door brought it first. Money in
 * is a credit, money out a debit; a row that moved no money is nothing.
 */
export const sepayPolledCredit = (
    connectionId: string,
    row: SepayTransaction,
    account: string,
): PolledCredit | undefined => {
    const credit = row.amountIn > 0
    const amount = credit ? row.amountIn : row.amountOut
    if (amount <= 0) return undefined
    return {
        deliveryId: `${connectionId}:sepay:${row.id}`,
        credit: {
            amount,
            content: row.content !== "" ? row.content : (row.code ?? ""),
            eventId: `sepay:${row.id}`,
            fallbackBankName: row.bank ?? FALLBACK_BANK,
            ...(credit ? {} : { direction: "debit" as const }),
            account,
            occurredAt: row.occurredAt.toISOString(),
        },
    }
}

/** One listed SePay transaction in the bank-feed shape nodes and agents read; a row that moved no money is nothing. */
export const sepayBankTransaction = (row: SepayTransaction): BankTransaction | undefined => {
    const credit = row.amountIn > 0
    const amountVnd = credit ? row.amountIn : row.amountOut
    if (amountVnd <= 0) return undefined
    return {
        id: `sepay:${row.id}`,
        direction: credit ? "credit" : "debit",
        amountVnd,
        content: row.content !== "" ? row.content : (row.code ?? ""),
        occurredAt: row.occurredAt.toISOString(),
        bankName: row.bank ?? FALLBACK_BANK,
    }
}
