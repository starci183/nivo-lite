import { TransactionEntity } from "./transaction.entity"

export { TransactionEntity } from "./transaction.entity"
export type { TransactionChannel, TransactionDirection, TransactionState } from "./transaction.entity"

/** Every entity of the transactions capability. */
export const transactionsEntities = [TransactionEntity] as const
