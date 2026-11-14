import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    ProviderRegistryError,
    ProviderRegistryErrorCode,
    providerCallFailure,
    type BusinessLedgerEntry,
    type LedgerPort,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService, type SandboxState } from "@modules/domain/provider-sandbox"
import { GOOGLE_LEDGER_CASE, GOOGLE_LEDGER_OPERATION, GOOGLE_LEDGER_SANDBOX_PROVIDER } from "./google-sandbox.catalogue"

/** State name: the next row of the cash book tab of the account (key ""), an integer; absent means 2 (row 1 is the header). */
const NEXT_ROW = "next-row"

/** State name: the rows the account holds, by bank transaction id (and `<id>:void` for a void row). */
const ROW = "row"

/** The tab the sandbox's rows are written on (hardcoded: the live tab's name is a localised word the sandbox needs not know). */
const TAB = "Sheet1"

/** The last column of a ledger row (eight columns: date .. balance). */
const LAST_COLUMN = "H"

/** The refusal of a ledger connection only the owner can cure, as the live twin throws it for a sheet or an access Google refuses. */
const refusedLedger = (): ProviderRegistryError =>
    new ProviderRegistryError({
        code: ProviderRegistryErrorCode.LedgerConnectionRefused,
        params: { provider: GOOGLE_LEDGER_SANDBOX_PROVIDER },
    })

/** The next row of the account: 2 until a row is appended, then the row after the last one. */
const nextRowOf = async (state: SandboxState): Promise<number> => {
    const kept = await state.read(NEXT_ROW, "")
    return typeof kept === "number" && Number.isInteger(kept) && kept >= 2 ? kept : 2
}

/** Keeps one appended row on the account's state and answers its range (`Sheet1!A<row>:H<row>`). */
const appendRow = async (state: SandboxState, key: string): Promise<string> => {
    const row = await nextRowOf(state)
    await state.write(ROW, key, row)
    await state.write(NEXT_ROW, "", row + 1)
    return `${TAB}!A${row}:${LAST_COLUMN}${row}`
}

@Injectable()
/**
 * The Google ledger's SANDBOX implementation of `LedgerPort` (R56 / R62): used when the ledger account is a sandbox account. It answers
 * through the generic sandbox frame from the hardcoded catalogue (`GOOGLE_LEDGER_SANDBOX_CATALOGUE`), reaches no Google host and holds
 * no token; one logged call per request.
 *
 * The account's sticky NEXT CASE of each operation picks the outcome, never the request: `ready` is true (GOOGLE-LEDGER-1, default) or
 * false (-2); `append` appends the next row and answers its range (-3, default), or is refused as the live twin refuses a sheet Google
 * will not take (the ledger connection refused, -4), or gives no answer (-5, `unknown`, no row kept), or fails before leaving (-6,
 * `not_sent`); `void` appends a void row naming the transaction (-7, default) or is refused (-8). Rows are numbered from 2 (row 1 is the
 * header the live twin writes first) and a repeat appends another row: like the live ledger, nothing here dedupes (the once-per-key
 * ledger of the tool does). A failure that applies nothing keeps no row. UNVERIFIED: whether live Google applied an unanswered append.
 */
export class GoogleSandboxLedgerService implements LedgerPort {
    /** The provider key. */
    readonly provider: string = GOOGLE_LEDGER_SANDBOX_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Whether the account may be picked, by its next case of `ready`, through exactly one sandbox call. */
    async ready(account: ConnectionRecord): Promise<boolean> {
        return await this.sandbox.call(account, GOOGLE_LEDGER_OPERATION.ready, {}, {
            answer: (state) => state.nextCase !== GOOGLE_LEDGER_CASE.notReady,
        })
    }

    /** Appends one entry as a row, by its next case of `append`, through exactly one sandbox call keyed by the bank transaction id. */
    async append(account: ConnectionRecord, entry: BusinessLedgerEntry): Promise<string> {
        return await this.sandbox.call(account, GOOGLE_LEDGER_OPERATION.append, entry, {
            key: entry.transactionId,
            answer: async (state) => {
                switch (state.nextCase) {
                    case GOOGLE_LEDGER_CASE.appendRefused:
                        throw refusedLedger()
                    case GOOGLE_LEDGER_CASE.appendNoAnswer:
                        throw providerCallFailure("unknown")
                    case GOOGLE_LEDGER_CASE.appendFailed:
                        throw providerCallFailure("not_sent")
                    default:
                        return await appendRow(state, entry.transactionId)
                }
            },
        })
    }

    /** Appends the void row of one transaction, by its next case of `void`, through exactly one sandbox call keyed by the transaction id. */
    async void(account: ConnectionRecord, transactionId: string): Promise<string> {
        return await this.sandbox.call(account, GOOGLE_LEDGER_OPERATION.void, { transactionId }, {
            key: transactionId,
            answer: async (state) => {
                if (state.nextCase === GOOGLE_LEDGER_CASE.voidRefused) throw refusedLedger()
                return await appendRow(state, `${transactionId}:void`)
            },
        })
    }
}
