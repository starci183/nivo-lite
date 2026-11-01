import type { NewSupplierPayable, SupplierPayableKeyParts, SupplierPayableRow } from "./supplier-payables.contracts"

/** The natural key of a supplier invoice: the seller tax code and the invoice number. */
export const supplierPayableKey = (payable: SupplierPayableKeyParts): string =>
    `${payable.sellerTaxCode}:${payable.invoiceNo}`

/** Whether an open row no longer says what the gateway lists, so it is rewritten. */
export const isStale = (row: SupplierPayableRow, listed: NewSupplierPayable): boolean =>
    row.status === "open" &&
    (row.amountVnd !== listed.amountVnd ||
        row.dueOn !== listed.dueOn ||
        row.issuedOn !== listed.issuedOn ||
        row.supplier !== listed.supplier)
