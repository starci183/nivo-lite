import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { isBankCreditPayload } from "@modules/queues/bank-credit"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"

/** The action that reconciles a payment with the invoice it settles. */
const RECONCILE = "reconcile_payment"
/** The locale of the lines a bank credit writes on its own: the workspace owners read them in Vietnamese. */
const RECORD_LOCALE = "vi"

@Injectable()
/**
 * What happens to a booked bank credit. A credit whose transfer content names exactly one issued invoice of the same amount is
 * reconciled by itself: its `reconcile_payment` work runs through the policy gate like a confirmed claim (invoice paid, transaction
 * matched, evidence, waiting claims settled, `payment.received`, the receipt chain), once per credit because the work is keyed on
 * its inbound event. Any other credit is held for the owner's check.
 */
export class BankCreditSettlementService {
    constructor(
        private readonly reconcile: ReconcilePaymentPerformerService,
        private readonly engine: WorkEngineService,
        private readonly inbound: InboundEventsService,
    ) {}

    /** The effect of one reconcile-bank-credit job; any other payload changes nothing. */
    async settle(payload: object): Promise<void> {
        if (!isBankCreditPayload(payload)) return
        const ctx: WorkContext = { workspaceId: payload.workspaceId, actor: "NIVO", locale: RECORD_LOCALE }
        if (await this.reconcile.clearlyMatches(ctx, payload.inboundEventId)) {
            await this.engine.startInboundWork(
                ctx,
                { id: payload.inboundEventId },
                RECONCILE,
                { amount_vnd: payload.amountVnd },
                null,
            )
            return
        }
        await this.inbound.holdForOwnerCheck(payload.inboundEventId)
    }
}
