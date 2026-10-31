import { builder } from "@starci/jest-preset"
import { supplierPayablesEntities } from "@modules/domain/supplier-payables"
import type { TaxProfile } from "@modules/domain/accounting"
import type { NewSupplierPayable, SupplierPayableRow } from "@modules/domain/supplier-payables"

const [SupplierPayableEntity] = supplierPayablesEntities
type SupplierPayableEntity = InstanceType<typeof SupplierPayableEntity>

/** A quarterly VAT payer, as the Brain tax profile reads. */
export const PAYABLE_PROFILE: TaxProfile = {
    taxCode: "0100109106",
    vatPeriod: "quarterly",
    withholdsPit: false,
    paysLicenseFee: false,
    establishedYear: 2020,
    reminderDays: 7,
    supplierTermDays: 30,
}

/** The workspace of the supplier-payable fixtures. */
export const PAYABLE_WORKSPACE = "ws-1"

/** When the payment of a paid fixture was confirmed. */
export const PAYABLE_PAID_AT = "2026-10-10T00:00:00.000Z"

/** A supplier invoice as the gateway lists it, with the date it falls due. */
export const listedPayable = builder<NewSupplierPayable>({
    supplier: "Linh An",
    sellerTaxCode: "0100109106",
    invoiceNo: "17",
    amountVnd: 4_620_000,
    issuedOn: "2026-10-01",
    dueOn: "2026-10-31",
})

/** An open supplier invoice row as the callers read it. */
export const payableRow = builder<SupplierPayableRow>({
    id: "pay-1",
    supplier: "Linh An",
    sellerTaxCode: "0100109106",
    invoiceNo: "17",
    amountVnd: 4_620_000,
    issuedOn: "2026-10-01",
    dueOn: "2026-10-31",
    status: "open",
    debitRef: null,
    paidAt: null,
    workItemId: null,
    firstSeenAt: "2026-10-15T00:00:00.000Z",
    decidedBy: null,
})

/** A supplier invoice row an outgoing payment settled. */
export const paidPayableRow = (patch: Partial<SupplierPayableRow> = {}): SupplierPayableRow =>
    payableRow({
        status: "paid",
        debitRef: "d-1",
        paidAt: PAYABLE_PAID_AT,
        workItemId: "work-1",
        decidedBy: "Lan",
        ...patch,
    })

/** The stored form of an open supplier invoice row. */
export const payableEntity = builder<SupplierPayableEntity>({
    id: "pay-1",
    workspaceId: PAYABLE_WORKSPACE,
    supplier: "Linh An",
    sellerTaxCode: "0100109106",
    invoiceNo: "17",
    amountVnd: "4620000",
    issuedOn: "2026-10-01",
    dueOn: "2026-10-31",
    status: "open",
    debitRef: null,
    paidAt: null,
    workItemId: null,
    firstSeenAt: new Date("2026-10-15T00:00:00Z"),
    decidedBy: null,
    createdAt: new Date("2026-10-15T00:00:00Z"),
    updatedAt: new Date("2026-10-15T00:00:00Z"),
})
