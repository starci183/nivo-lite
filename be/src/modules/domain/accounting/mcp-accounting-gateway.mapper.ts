import type { EinvoiceDraft, EinvoiceLine, GatewayPayable } from "./accounting-desk.contracts"
import type { GatewayEinvoice, OptionalReceivable, PaymentCredit } from "./accounting-gateway.port"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const text = (row: Json, key: string): string => {
    const value = row[key]
    return typeof value === "string" ? value : ""
}

const amount = (row: Json, key: string): number => {
    const value = row[key]
    return typeof value === "number" && Number.isFinite(value) ? value : 0
}

const lineOf = (value: unknown): EinvoiceLine | null => {
    if (!isJson(value)) return null
    const rate = value.vatRate
    return {
        name: text(value, "name"),
        quantity: amount(value, "quantity"),
        amountVnd: amount(value, "amountVnd"),
        vatRate: typeof rate === "number" ? rate : null,
    }
}

/** The TT78 draft an `invoice.list` row carries beside the role's fields; null when the row carries none. */
export const draftOf = (value: unknown): EinvoiceDraft | null => {
    if (!isJson(value)) return null
    const lines = Array.isArray(value.lines) ? value.lines : []
    return {
        source: value.source === "pdf" ? "pdf" : "xml",
        template: text(value, "template"),
        series: text(value, "series"),
        invoiceNo: text(value, "invoiceNo"),
        issuedOn: text(value, "issuedOn"),
        sellerName: text(value, "sellerName"),
        sellerTaxCode: text(value, "sellerTaxCode"),
        buyerName: text(value, "buyerName"),
        buyerTaxCode: text(value, "buyerTaxCode"),
        lines: lines.flatMap((line) => lineOf(line) ?? []),
        subtotalVnd: amount(value, "subtotalVnd"),
        vatVnd: amount(value, "vatVnd"),
        totalVnd: amount(value, "totalVnd"),
    }
}

/** One `invoice.list` row as the desk reads it: its id as the source reference and its draft. */
export const einvoiceOf = (row: unknown): GatewayEinvoice | null => {
    if (!isJson(row)) return null
    const draft = draftOf(row.draft)
    const ref = text(row, "id")
    return draft === null || ref === "" ? null : { ref, draft }
}

/** One `invoice.list` row as a supplier payable. */
export const payableOf = (row: unknown): GatewayPayable | null => {
    if (!isJson(row)) return null
    const invoiceNo = text(row, "number")
    if (invoiceNo === "") return null
    return {
        supplier: text(row, "sellerName"),
        sellerTaxCode: text(row, "sellerTaxCode"),
        invoiceNo,
        amountVnd: amount(row, "totalVnd"),
        issuedOn: text(row, "issuedOn"),
    }
}

/** One `payment.credits.list` row as a payment credit (matched once the connector reports it reconciled). */
export const paymentCreditOf = (row: unknown): PaymentCredit | null => {
    if (!isJson(row)) return null
    const creditRef = text(row, "id")
    if (creditRef === "") return null
    return {
        creditRef,
        reference: text(row, "reference"),
        amountVnd: amount(row, "amountVnd"),
        occurredAt: text(row, "occurredAt"),
        matched: row.status === "matched",
    }
}

/** The `receivable.find` answer as a receivable; null when the connector found none. */
export const receivableOf = (value: Json): OptionalReceivable => {
    const receivableId = text(value, "receivableId")
    return value.found === true && receivableId !== ""
        ? { receivableId, balanceVnd: amount(value, "balanceVnd") }
        : null
}

/** Whether the `receivable.recordPayment` answer names the recorded payment (a duplicate names the first one). */
export const recordedOf = (value: Json): boolean => text(value, "paymentId") !== ""
