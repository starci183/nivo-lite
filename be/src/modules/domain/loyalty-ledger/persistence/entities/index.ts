import { LoyaltyLedgerEntity } from "./loyalty-ledger.entity"

export { LoyaltyLedgerEntity }

/** The entities the loyalty-ledger capability owns, collected by the database module. */
export const loyaltyLedgerEntities: readonly [typeof LoyaltyLedgerEntity] = [LoyaltyLedgerEntity] as const
