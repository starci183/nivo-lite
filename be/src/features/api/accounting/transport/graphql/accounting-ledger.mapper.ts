import type { AccountingLedgerEntry } from "@modules/domain/accounting"
import type { AccountingLedgerEntryType } from "./dto/accounting-ledger-entry.type"

/** Maps the deterministic ledger rows to the shared accounting GraphQL type. */
export const toAccountingLedgerType = (
    result: ReadonlyArray<AccountingLedgerEntry>,
): ReadonlyArray<AccountingLedgerEntryType> =>
    result.map((entry) => ({ ...entry, lineage: entry.lineage.map((step) => ({ ...step })) }))
