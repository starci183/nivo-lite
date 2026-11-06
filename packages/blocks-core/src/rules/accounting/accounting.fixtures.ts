import type { AdjustmentRecord, ClaimRecord, InvoiceRecord, OrderRecord, TransactionRecord } from "./accounting.types"

/** The workspace's money in: 5,000,000 VND from Dinh on 4 Nov 2026 at 18:30 shop time (11:30 UTC), matched to his order. */
export const TRANSACTION: TransactionRecord = {
    id: "00000000-0000-4000-8000-0000000000a1",
    version: "3",
    amountVnd: 5_000_000,
    direction: "credit",
    reference: "NIVO8F3K2 chuyen tien",
    payer: "NGUYEN VAN DINH",
    occurredAt: "2026-11-04T11:30:00.000Z",
    status: "unmatched",
    orderId: null,
}

/** Dinh's order: confirmed, waiting for the 5,000,000 VND. */
export const ORDER: OrderRecord = {
    id: "00000000-0000-4000-8000-0000000000b1",
    version: "2",
    orderNo: "DH-20261104-0001",
    amountVnd: 5_000_000,
    status: "confirmed",
    leadId: "00000000-0000-4000-8000-0000000000c1",
}

/** Dinh's claim that he paid. */
export const CLAIM: ClaimRecord = {
    id: "00000000-0000-4000-8000-0000000000d1",
    version: "1",
    amountVnd: 5_000_000,
    status: "open",
    orderId: ORDER.id,
    settledTransactionId: null,
    conversationId: "00000000-0000-4000-8000-0000000000e1",
}

/** An invoice issued on 1 Nov 2026 for 2,000,000 VND, still open. */
export const INVOICE: InvoiceRecord = {
    id: "00000000-0000-4000-8000-0000000000f1",
    invoiceNo: "INV-202611-0001",
    amountVnd: 2_000_000,
    status: "issued",
    dueAt: "2026-11-16T00:00:00.000Z",
    issuedAt: "2026-11-01T03:00:00.000Z",
    paidAt: null,
    createdAt: "2026-11-01T02:00:00.000Z",
    customer: "Nguy\u1ec5n V\u0103n \u0110\u1ecbnh",
}

/** A correction to the invoice: 1,800,000 VND instead. */
export const ADJUSTMENT: AdjustmentRecord = {
    id: "00000000-0000-4000-8000-0000000000a2",
    targetType: "invoice",
    targetId: INVOICE.id,
    note: "Gi\u1ea3m gi\u00e1 \u0111\u00e3 th\u1ecfa thu\u1eadn qua \u0111i\u1ec7n tho\u1ea1i",
    correctedAmountVnd: 1_800_000,
    createdBy: "Lan",
    createdAt: "2026-11-02T04:00:00.000Z",
}

/** A transaction, with some members replaced. */
export const transactionOf = (changes: Partial<TransactionRecord> = {}): TransactionRecord => ({
    ...TRANSACTION,
    ...changes,
})

/** An order, with some members replaced. */
export const orderOf = (changes: Partial<OrderRecord> = {}): OrderRecord => ({ ...ORDER, ...changes })

/** A claim, with some members replaced. */
export const claimOf = (changes: Partial<ClaimRecord> = {}): ClaimRecord => ({ ...CLAIM, ...changes })

/** An invoice, with some members replaced. */
export const invoiceOf = (changes: Partial<InvoiceRecord> = {}): InvoiceRecord => ({ ...INVOICE, ...changes })

/** An adjustment, with some members replaced. */
export const adjustmentOf = (changes: Partial<AdjustmentRecord> = {}): AdjustmentRecord => ({
    ...ADJUSTMENT,
    ...changes,
})
