import { Injectable } from "@nestjs/common"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionPoller, PollPage, PollWindow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectSepay } from "@modules/integrations/sepay"
import type { SepayClient } from "@modules/integrations/sepay"
import { BankFeedService } from "./bank-feed.service"
import type { PolledCredit } from "./bank-feed-poll.contracts"
import { sepayPolledCredit } from "./sepay-poll.policy"

@Injectable()
/** Reads the transactions of a SePay connection's bank account from the SePay user API, with the API token that connection holds. */
export class SepayFeedPoller implements ConnectionPoller<PolledCredit> {
    readonly provider = "sepay"

    constructor(
        @InjectSepay() private readonly sepay: SepayClient,
        private readonly tokens: ConnectionApiTokenService,
        private readonly feed: BankFeedService,
    ) {}

    /** Reads one page; a connection with no API token or no full account number is left out, not failed. */
    async fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<PolledCredit>> {
        const account = connection.meta.account_number ?? ""
        if (account === "") return { kind: "skipped", reason: "no_account" }
        const token = await this.tokens.read(connection.id)
        if (token === null) return { kind: "skipped", reason: "no_token" }
        const rows = await this.sepay.listTransactions(token, {
            accountNumber: account,
            from: window.from,
            to: window.to,
            limit: window.limit,
        })
        const times = rows.map((row) => row.occurredAt.getTime())
        return {
            kind: "page",
            items: rows.flatMap((row) => {
                const credit = sepayPolledCredit(connection.id, row)
                return credit === undefined ? [] : [credit]
            }),
            fetched: rows.length,
            oldestAt: rows.length === 0 ? undefined : new Date(Math.min(...times)),
            newestAt: rows.length === 0 ? undefined : new Date(Math.max(...times)),
        }
    }

    /** Hands the transaction to the feed receipt the SePay webhook feeds; false when the webhook (or an earlier poll) already did. */
    store(connection: ConnectionRecord, item: PolledCredit): Promise<boolean> {
        return this.feed.acceptPolledCredit(connection.id, "sepay-feed", item.deliveryId, item.credit)
    }
}
