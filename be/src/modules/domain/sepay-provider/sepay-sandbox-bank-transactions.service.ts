import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { BankTransaction, BankTransactionsPort, BankTransactionsQuery } from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { sepayBankTransaction } from "./sepay-poll.policy"
import { SEPAY_SANDBOX_MOVEMENTS_STATE, sepayMovementsOf } from "./sepay-sandbox.catalogue"
import { sepayRowsIn } from "./sepay-sandbox-movements.policy"

/** The instant a list without a start reads from: before every movement (a fixed value, never the clock). */
const BEGINNING = new Date("2000-01-01T00:00:00.000Z")

@Injectable()
/**
 * The sandbox twin of the SePay transaction list: the movements the account's inbound cases made (`SEPAY-1..`, R62) inside the query's
 * window, newest first, at most `limit`, in the bank-feed shape. A list without a start reads them all (the live default window counts back from the clock,
 * which a sandbox answer never reads). It never calls SePay and needs no token.
 */
export class SepaySandboxBankTransactionsService implements BankTransactionsPort {
    readonly provider = "sepay"

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** The account's movements in the window, newest first. */
    transactions(connection: ConnectionRecord, query: BankTransactionsQuery): Promise<ReadonlyArray<BankTransaction> | undefined> {
        return this.sandbox.call(connection, "transactions", query, {
            key: query.since?.toISOString() ?? "",
            answer: async (state) =>
                sepayRowsIn(sepayMovementsOf(await state.read(SEPAY_SANDBOX_MOVEMENTS_STATE, "")), query.since ?? BEGINNING, query.until, query.limit).flatMap(
                    (row) => {
                        const transaction = sepayBankTransaction(row)
                        return transaction === undefined ? [] : [transaction]
                    },
                ),
        })
    }
}
