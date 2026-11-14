import { Injectable } from "@nestjs/common"
import type { PollFailure, PollLimits, PollPage, PollWindow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { BankFeedPoller, PolledCredit } from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { sepayPolledCredit } from "./sepay-poll.policy"
import { SEPAY_SANDBOX_MOVEMENTS_STATE, sepayMovementsOf } from "./sepay-sandbox.catalogue"
import { sepayRowsIn } from "./sepay-sandbox-movements.policy"

@Injectable()
/**
 * The sandbox twin of the SePay poller: it answers the window from the movements the account's inbound cases made (`SEPAY-1..`, R62:
 * what the SePay user API would list), newest first, honouring `from`, `to` and `limit`, as the credits the webhook would have delivered (same delivery key
 * and event id, so a movement the webhook also brought is one inbox row). It never calls SePay and needs no token.
 */
export class SepaySandboxFeedPollerService implements BankFeedPoller {
    readonly provider = "sepay"
    readonly inboxProvider = "sepay-feed"
    /** The live poller's limits: the same scheduler contract. */
    readonly limits: PollLimits = { ratePerSecond: 2, burst: 2, concurrency: 1 }

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** The catalogue movements of the window as one page. */
    fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<PolledCredit>> {
        return this.sandbox.call(connection, "fetch", window, {
            key: window.from.toISOString(),
            answer: async (state): Promise<PollPage<PolledCredit>> => {
                const movements = sepayMovementsOf(await state.read(SEPAY_SANDBOX_MOVEMENTS_STATE, ""))
                const rows = sepayRowsIn(movements, window.from, window.to, window.limit)
                const times = rows.map((row) => row.occurredAt.getTime())
                return {
                    kind: "page",
                    items: rows.flatMap((row) => {
                        const credit = sepayPolledCredit(connection.id, row, row.account)
                        return credit === undefined ? [] : [credit]
                    }),
                    fetched: rows.length,
                    oldestAt: rows.length === 0 ? undefined : new Date(Math.min(...times)),
                    newestAt: rows.length === 0 ? undefined : new Date(Math.max(...times)),
                }
            },
        })
    }

    /** A sandbox read has no provider failure: anything thrown is given up on. */
    classify(): PollFailure {
        return { kind: "fatal" }
    }
}
