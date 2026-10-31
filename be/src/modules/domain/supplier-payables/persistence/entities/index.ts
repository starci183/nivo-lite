import { SupplierPayableEntity } from "./supplier-payable.entity"

export { SupplierPayableEntity }

/** Every entity the supplier-payables capability owns, collected by the database connection. */
export const supplierPayablesEntities = [SupplierPayableEntity] as const
