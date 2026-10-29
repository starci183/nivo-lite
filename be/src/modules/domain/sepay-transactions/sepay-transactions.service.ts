import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import {
    isSepayDeliveryRecorded,
    SEPAY_DELIVERY_QUEUE,
    type SepayDeliveryRecorded,
} from "@modules/queues/sepay-delivery"
import { InjectEntityInbox } from "@modules/platform/inbox"
import type { EntityInbox } from "@modules/platform/inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager, ObjectLiteral } from "typeorm"
import { PaymentProofService, parseJsonObject, sepayPayloadOf } from "@modules/domain/billing"
import type { SepayDelivery, SepayPayload } from "@modules/domain/billing"
import { orderCodesIn, PaymentOrdersService } from "@modules/domain/payment-orders"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import type { ReviewTransaction, SepayAuthorization, SettleOutcome } from "./sepay-transactions.contracts"
import { transactionStatus } from "./sepay-transactions.policy"
import { SepayTransactionEntity } from "./persistence/entities"

/** The most transfers one review lists. */
const REVIEW_ROWS_MAX = 50

/** The statuses a transfer needs a person to look at. */
const REVIEW_STATUSES: ReadonlyArray<string> = ["underpaid", "expired", "unmatched"]

/** The provider name of NIVO's own billing feed in the delivery inbox. */
const SEPAY_PROVIDER = "sepay"

@Injectable()
/**
 * Settles payment orders from SePay's bank webhook. The SePay transaction id is the idempotency key: the delivery claims its row
 * first, atomically with its receipt outbox message. A deferred consumer settles the order and completes the receipt in one
 * transaction, so duplicates cannot settle twice and failures leave the committed receipt available for a job retry.
 */
export class SepayTransactionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly proof: PaymentProofService,
        @InjectEntityInbox() private readonly inbox: EntityInbox,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly orders: PaymentOrdersService,
    ) {}

    /** Transfers needing review on the requested orders; the workspace predicate prevents cross-workspace disclosure. */
    async review(workspaceId: string, orderIds: ReadonlyArray<string>): Promise<Array<ReviewTransaction>> {
        const ownedIds = await this.orders.idsOfWorkspace(workspaceId, orderIds)
        if (ownedIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(SepayTransactionEntity, "t")
            .where("t.matchedOrderId IN (:...ownedIds)", { ownedIds })
            .andWhere("t.status IN (:...statuses)", { statuses: REVIEW_STATUSES })
            .orderBy("t.receivedAt", "DESC")
            .limit(REVIEW_ROWS_MAX)
            .getMany()
        return rows.map((row) => ({
            id: row.sepayId,
            status: row.status,
            transferAmount: row.transferAmount ?? 0,
            receivedAt: row.receivedAt.toISOString(),
            content: row.content,
        }))
    }

    /** Proves the SePay billing API key before the HTTP door passes the delivery to settlement intake. */
    verifySepayDelivery(authorization: SepayAuthorization): void {
        this.proof.verifyBillingKey(authorization)
    }

    /**
     * Proves and records one SePay delivery from its raw bytes for deferred settlement. Only an incoming transfer whose content (or SePay code)
     * names a pending, unexpired order and covers its amount settles it, atomically in SQL; every other transfer is stored for the
     * manual review on the billing page. A repeated delivery is acknowledged without being applied again.
     */
    async acceptSepayDelivery(delivery: SepayDelivery): Promise<void> {
        this.proof.verifyBillingKey(delivery.authorization)
        const body = parseJsonObject(delivery.rawBody)
        const payload = sepayPayloadOf(body)
        const deliveryId = String(payload.id)
        await this.entityManager.transaction(async (manager) => {
            const receiptId = await this.inbox.claimRow<ObjectLiteral>(SEPAY_PROVIDER, deliveryId, manager, {
                entity: SepayTransactionEntity,
                row: () => ({ sepayId: payload.id, payload: body }),
            })
            if (receiptId === undefined) return
            const message: SepayDeliveryRecorded = { deliveryId }
            await this.outbox.write(manager, SEPAY_DELIVERY_QUEUE, message, {
                dedupeKey: `${SEPAY_DELIVERY_QUEUE}:${deliveryId}`,
            })
        })
    }

    /** Validates the receipt before advancing its live fence, then consumes the committed receipt. */
    async processClaimedDelivery(job: ClaimedJob, claims: JobClaims): Promise<void> {
        if (!isSepayDeliveryRecorded(job.payload)) return
        await claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "sepay-delivery",
        })
        await this.processRecordedDelivery(job.payload)
    }

    /** Settles one committed receipt and completes it in the same retryable transaction. */
    processRecordedDelivery(message: SepayDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const pending = await manager.findOne(SepayTransactionEntity, {
                where: { sepayId: Number(message.deliveryId), processedAt: IsNull() },
                lock: { mode: "pessimistic_write" },
            })
            if (pending === null) return
            await this.settle(manager, sepayPayloadOf(pending.payload))
            await manager.update(SepayTransactionEntity, { id: pending.id }, { processedAt: () => "now()" })
        })
    }

    private async settle(manager: EntityManager, payload: SepayPayload): Promise<void> {
        const amount = payload.transferAmount
        const isCredit = payload.transferType === "in"
        const codes = isCredit ? orderCodesIn(payload.code, payload.content, payload.description) : []
        const outcome = amount === undefined ? "unmatched" : await this.settleFirst(manager, codes, amount, payload.id)
        await manager.update(
            SepayTransactionEntity,
            { sepayId: payload.id },
            {
                status: transactionStatus(isCredit, outcome),
                transferAmount: amount ?? null,
                content: payload.content ?? payload.code ?? null,
            },
        )
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
        const [settled] = await callDbFunction<{ settle_payment_order: SettleOutcome }>(
            manager,
            "public.settle_payment_order",
            [code, amount, sepayId],
        )
        const outcome = settled?.settle_payment_order ?? "unmatched"
        return outcome === "unmatched" ? this.settleFirst(manager, rest, amount, sepayId) : outcome
    }
}
