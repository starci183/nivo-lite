import type { GatewayPayable, PayableMatches, UnclearPayment } from "./accounting-desk.contracts"
import type { PaymentCredit } from "./accounting-gateway.port"

/** Letters and digits only, upper case: how an invoice number is looked for inside a transfer memo. */
const compact = (text: string): string => text.toUpperCase().replace(/[^0-9A-Z]/gu, "")

/** Whether the memo of an outgoing payment names the invoice number (punctuation and spacing ignored). */
const namesInvoice = (debit: PaymentCredit, payable: GatewayPayable): boolean => {
    const invoiceNo = compact(payable.invoiceNo).replace(/^0+/u, "")
    return invoiceNo !== "" && compact(debit.reference).includes(invoiceNo)
}

/**
 * Matches the outgoing payments to the open supplier invoices: a debit of the invoice's exact amount whose memo names the
 * invoice number pays it; a debit with only one of the two (the amount, or the invoice number) is unclear and needs a person;
 * an invoice with neither is still open. Each debit pays at most one invoice, the first open one it fully matches.
 */
export const matchPayables = (
    payables: ReadonlyArray<GatewayPayable>,
    debits: ReadonlyArray<PaymentCredit>,
): PayableMatches => {
    const used = new Set<string>()
    const paid: Array<GatewayPayable> = []
    const open: Array<GatewayPayable> = []
    const unclear: Array<UnclearPayment> = []
    for (const payable of payables) {
        const exact = debits.find(
            (debit) =>
                !used.has(debit.creditRef) && debit.amountVnd === payable.amountVnd && namesInvoice(debit, payable),
        )
        if (exact !== undefined) {
            used.add(exact.creditRef)
            paid.push(payable)
            continue
        }
        open.push(payable)
        const partial = debits.find(
            (debit) =>
                !used.has(debit.creditRef) && (debit.amountVnd === payable.amountVnd || namesInvoice(debit, payable)),
        )
        if (partial !== undefined) unclear.push({ payable, debit: partial })
    }
    return { paid, open, unclear }
}
