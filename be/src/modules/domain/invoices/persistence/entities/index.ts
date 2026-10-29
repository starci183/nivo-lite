import { InvoiceEntity } from "./invoice.entity"

export { InvoiceEntity }
export type { InvoiceStatus } from "./invoice.entity"

/** The entities the invoices capability owns, collected by the database module. */
export const invoicesEntities = [InvoiceEntity] as const
