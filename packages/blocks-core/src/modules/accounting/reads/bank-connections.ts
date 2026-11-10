import type { BankConnection } from "../../../rules/accounting/recent"
import type { ConnectionRow } from "../../../views/views.types"

/** The connections of the agent a bank payment can come through: the ones it is granted, with a provider and a level. */
export const bankConnectionsOf = (rows: ReadonlyArray<ConnectionRow>): ReadonlyArray<BankConnection> =>
    rows.flatMap((row) =>
        row.isGranted === false || row.provider === undefined || row.access === undefined
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
