import { Injectable } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { PollScheduleService, PollSourceRegistry } from "@modules/domain/connection-poll"
import type { PollHotReason } from "@modules/domain/connection-poll"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { OrdersLogEvent } from "./orders.log-events"

/** How long polling stays fast after an order is confirmed and awaits money: two hours. */
const ORDER_AWAITING_TTL_MS = 2 * 60 * 60_000

/** How long polling stays fast after a customer says they paid: half an hour. */
const CLAIM_OPEN_TTL_MS = 30 * 60_000

/** The most connections of one provider that are told. */
const CONNECTIONS_LIMIT = 20

@Injectable()
/**
 * Tells the scheduler that money is awaited, so the bank-feed connections of the workspace are polled fast for a while. The connections are
 * found through the provider registry of the scheduler (every provider that can be polled), so no provider is named here. Telling the scheduler
 * never fails the order or the claim: the normal polling still finds the money.
 */
export class PaymentDemandService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly sources: PollSourceRegistry,
        private readonly schedule: PollScheduleService,
        private readonly bindings: ConnectionBindingsReadService,
    ) {}

    /** An order was confirmed with an amount to pay. */
    orderAwaitingPayment(workspaceId: string): Promise<void> {
        return this.hot(workspaceId, "order_awaiting_payment", ORDER_AWAITING_TTL_MS)
    }

    /** A customer said they paid and no money has been seen yet. */
    claimOpen(workspaceId: string): Promise<void> {
        return this.hot(workspaceId, "payment_claim_open", CLAIM_OPEN_TTL_MS)
    }

    private async hot(workspaceId: string, reason: PollHotReason, ttlMs: number): Promise<void> {
        try {
            await eachInOrder(this.sources.providers(), async (provider) => {
                const connections = await this.bindings.ofProvider(workspaceId, provider, CONNECTIONS_LIMIT)
                await eachInOrder(connections, (connection) => this.schedule.markHot(connection.id, reason, ttlMs))
            })
        } catch (cause) {
            this.logger.error(OrdersLogEvent.PaymentDemandFailed, cause, { workspaceId, reason })
        }
    }
}
