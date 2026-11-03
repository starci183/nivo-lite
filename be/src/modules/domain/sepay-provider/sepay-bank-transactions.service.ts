import { Injectable } from "@nestjs/common"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { BankTransaction, BankTransactionsPort, BankTransactionsQuery } from "@modules/domain/provider-registry"
import { InjectSepay } from "@modules/integrations/sepay"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { SepayClient } from "@modules/integrations/sepay"
import { sepayBankTransaction } from "./sepay-poll.policy"

/** How far back a list reaches when the caller names no start. */
const DEFAULT_WINDOW_MS = 7 * 86_400_000

@Injectable()
/** Lists the transactions of a SePay connection's bank account for nodes and agents, through the SePay user API and the connection's sealed API token. */
export class SepayBankTransactionsService implements BankTransactionsPort {
    readonly provider = "sepay"

    constructor(
        @InjectSepay() private readonly sepay: SepayClient,
        private readonly tokens: ConnectionApiTokenService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The money moves in the window, newest first; undefined when the connection has no API token or no full account number. */
    async transactions(
        connection: ConnectionRecord,
        query: BankTransactionsQuery,
    ): Promise<ReadonlyArray<BankTransaction> | undefined> {
        const account = connection.meta.account_number ?? ""
        const token = account === "" ? null : await this.tokens.read(connection.id)
        if (token === null) return undefined
        const from = query.since ?? new Date(this.clock.now().getTime() - DEFAULT_WINDOW_MS)
        const rows = await this.sepay.listTransactions(token, {
            accountNumber: account,
            from,
            to: query.until,
            limit: query.limit,
        })
        return rows.flatMap((row) => {
            const transaction = sepayBankTransaction(row)
            return transaction === undefined ? [] : [transaction]
        })
    }
}
