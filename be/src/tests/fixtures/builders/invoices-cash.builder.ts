import { invoicesEntities } from "@modules/domain/invoices"
import { entityOf } from "./entity.builder"

const [InvoiceEntity] = invoicesEntities

const FROM = new Date("2026-10-01T00:00:00Z")
const TO = new Date("2026-11-01T00:00:00Z")

/** An issued invoice of a contract with a billing period, as the cash read finds it. */
export const cashInvoiceOf = entityOf(InvoiceEntity, {
    invoiceNo: "HD1",
    amountVnd: 1000,
    contractId: "c-1",
    leadId: "l-1",
    periodEndsOn: "2026-12-31",
    issuedAt: FROM,
    dueAt: TO,
    paidAt: null,
})

/** The same invoice without a billing period. */
export const undatedInvoiceOf = () => cashInvoiceOf({ periodEndsOn: null })

/** The same invoice without a contract. */
export const uncontractedInvoiceOf = () => cashInvoiceOf({ contractId: null })
