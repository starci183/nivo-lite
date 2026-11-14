import type { BankConnection } from "../../../../rules/sales/ledger/recent"
import type { ConnectionRow } from "../../../../views/views.types"

/** The providers attached to the agent a bank payment can come through: the ones it holds an ability on, with its level. */
export const bankConnectionsOf = (rows: ReadonlyArray<ConnectionRow>): ReadonlyArray<BankConnection> =>
    rows.flatMap((row) =>
        row.access === undefined
            ? []
            : [
                  {
                      provider: row.provider,
                      name: row.name,
                      accountMasked: row.accountMasked ?? null,
                      access: row.access,
                  },
              ],
    )
