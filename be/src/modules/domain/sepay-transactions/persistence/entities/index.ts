import { SepayTransactionEntity } from "./sepay-transaction.entity"

export { SepayTransactionEntity } from "./sepay-transaction.entity"

/** Every entity of the sepay-transactions capability. */
export const sepayTransactionsEntities: readonly [typeof SepayTransactionEntity] = [SepayTransactionEntity] as const
