import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { PaymentProofService, parseJsonObject, sepayPayloadOf } from "@modules/domain/billing"
import type { SepayDelivery, SepayPayload } from "@modules/domain/billing"
import { orderCodesIn } from "@modules/domain/payment-orders"
import { acceptWebhookDelivery, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SettleOutcome } from "./sepay-transactions.contracts"
import { transactionStatus } from "./sepay-transactions.policy"
import {
    COMPLETE_SEPAY_TRANSACTION,
    INSERT_SEPAY_TRANSACTION,
    SETTLE_PAYMENT_ORDER,
    UPDATE_SEPAY_RESULT,
} from "./persistence/sepay-transactions.sql"
import type { SettleRow } from "./persistence/sepay-transactions.rows"

/** The provider name of NIVO's own billing feed in the delivery inbox. */
const SEPAY_PROVIDER = "sepay"

@Injectable()
/**
 * Settles payment orders from SePay's bank webhook. The SePay transaction id is the idempotency key: the delivery claims its row
 * first, in the same transaction that settles the order and records the outcome, so a repeat finds the row processed and is
 * acknowledged without settling twice, and a crash before the commit leaves nothing behind for the retry to trip over.
 */
export class SepayTransactionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly proof: PaymentProofService,
    ) {}

    /**
     * Proves, records and settles one SePay delivery from its raw bytes. Only an incoming transfer whose content (or SePay code)
     * names a pending, unexpired order and covers its amount settles it, atomically in SQL; every other transfer is stored for the
     * manual review on the billing page. A repeated delivery is acknowledged without being applied again.
     */
    async acceptSepayDelivery(delivery: SepayDelivery): Promise<void> {
        this.proof.verifyBillingKey(delivery.authorization)
        const body = parseJsonObject(delivery.rawBody)
        const payload = sepayPayloadOf(body)
        await acceptWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_SEPAY_TRANSACTION,
            complete: COMPLETE_SEPAY_TRANSACTION,
            provider: SEPAY_PROVIDER,
            deliveryId: String(payload.id),
            payload: body,
            process: (manager) => this.settle(manager, payload),
        })
    }

    private async settle(manager: EntityManager, payload: SepayPayload): Promise<void> {
        const amount = payload.transferAmount
        const isCredit = payload.transferType === "in"
        const codes = isCredit ? orderCodesIn(payload.code, payload.content, payload.description) : []
        const outcome = amount === undefined ? "unmatched" : await this.settleFirst(manager, codes, amount, payload.id)
        await manager.query(UPDATE_SEPAY_RESULT, [
            payload.id,
            transactionStatus(isCredit, outcome),
            amount ?? null,
            payload.content ?? payload.code ?? null,
        ])
    }

    /** Settles with the first code that names an order; a code that names none is skipped, and no code is unmatched. */
    private async settleFirst(
        manager: EntityManager,
        codes: ReadonlyArray<string>,
        amount: number,
        sepayId: number,
    ): Promise<SettleOutcome> {
        const [code, ...rest] = codes
        if (code === undefined) return "unmatched"
        const [settled] = await manager.query<Array<SettleRow>>(SETTLE_PAYMENT_ORDER, [code, amount, sepayId])
        const outcome = settled?.outcome ?? "unmatched"
        return outcome === "unmatched" ? this.settleFirst(manager, rest, amount, sepayId) : outcome
    }
}
