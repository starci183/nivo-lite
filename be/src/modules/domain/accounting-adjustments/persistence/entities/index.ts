import { AccountingAdjustmentEntity } from "./accounting-adjustment.entity"

export { AccountingAdjustmentEntity }

/** Every entity the accounting-adjustments capability owns, collected by the database connection. */
export const accountingAdjustmentsEntities = [AccountingAdjustmentEntity] as const
