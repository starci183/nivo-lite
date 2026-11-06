import { Injectable } from "@nestjs/common"
import type { PollFailure, PollLimits, PollPage, PollWindow } from "@modules/domain/connection-poll"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { BankFeedPoller, PolledCredit } from "@modules/domain/provider-registry"
import { InjectSepay, SepayError, SepayErrorCode } from "@modules/integrations/sepay"
import type { SepayClient } from "@modules/integrations/sepay"
import { sepayPolledCredit } from "./sepay-poll.policy"

@Injectable()
/** Reads the transactions of a SePay connection's bank account from the SePay user API, with the API token that connection holds. */
export class SepayFeedPollerService implements BankFeedPoller {
    readonly provider = "sepay"
    readonly inboxProvider = "sepay-feed"
    /**
     * Conservative until SePay publishes more: its user API is documented at about two calls per second per account, so one credential
     * gets that rate, no larger burst and one call at a time.
     */
    readonly limits: PollLimits = { ratePerSecond: 2, burst: 2, concurrency: 1 }

    constructor(
        @InjectSepay() private readonly sepay: SepayClient,
        private readonly tokens: ConnectionApiTokenService,
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
                const credit = sepayPolledCredit(connection.id, row, account)
                return credit === undefined ? [] : [credit]
            }),
            fetched: rows.length,
            oldestAt: rows.length === 0 ? undefined : new Date(Math.min(...times)),
            newestAt: rows.length === 0 ? undefined : new Date(Math.max(...times)),
        }
    }

    /** Classifies a SePay failure: asked to slow down, token refused, unreachable (retry later) or anything else (give up). */
    classify(error: unknown): PollFailure {
        if (!(error instanceof SepayError)) return { kind: "fatal" }
        if (error.code === SepayErrorCode.RateLimited) {
            const seconds: unknown = error.params.retryAfterSeconds
            return { kind: "rate_limited", retryAfterSeconds: typeof seconds === "number" ? seconds : 0 }
        }
        if (error.code === SepayErrorCode.AuthFailed) return { kind: "auth_failed" }
        return error.code === SepayErrorCode.Unavailable ? { kind: "transient" } : { kind: "fatal" }
    }
}
