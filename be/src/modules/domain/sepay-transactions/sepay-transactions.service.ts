import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { isSepayDeliveryRecorded } from "@modules/queues/sepay-delivery"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { SEPAY_DELIVERY_QUEUE } from "@modules/queues/sepay-delivery"
import type { SepayDeliveryRecorded } from "@modules/queues/sepay-delivery"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { PaymentProofService, parseJsonObject, sepayPayloadOf } from "@modules/domain/billing"
import type { SepayDelivery, SepayPayload } from "@modules/domain/billing"
import { orderCodesIn } from "@modules/domain/payment-orders"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ReviewTransaction, SepayAuthorization, SettleOutcome } from "./sepay-transactions.contracts"
import { transactionStatus } from "./sepay-transactions.policy"
import {
    COMPLETE_SEPAY_TRANSACTION,
    INSERT_SEPAY_TRANSACTION,
    FIND_PENDING_SEPAY_INBOX,
    SELECT_REVIEW_TRANSACTIONS,
    SETTLE_PAYMENT_ORDER,
    UPDATE_SEPAY_RESULT,
} from "./persistence/sepay-transactions.sql"
import type { ReviewTransactionRow, SettleRow } from "./persistence/sepay-transactions.rows"

/** The locked receipt consumed in the settlement transaction. */
type PendingSepayReceipt = {
    readonly id: string
    readonly payload: Readonly<Record<string, unknown>>
}

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
        @InjectInbox() private readonly inbox: Inbox,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /** Transfers needing review on the requested orders; the workspace predicate prevents cross-workspace disclosure. */
    async review(workspaceId: string, orderIds: ReadonlyArray<string>): Promise<Array<ReviewTransaction>> {
        if (orderIds.length === 0) return []
        const rows = await this.entityManager.query<Array<ReviewTransactionRow>>(SELECT_REVIEW_TRANSACTIONS, [
            workspaceId,
            orderIds,
        ])
        return rows.map((row) => ({
            id: row.id,
            status: row.status,
            transferAmount: row.transfer_amount,
            receivedAt: new Date(row.received_at).toISOString(),
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
            if (
                !(await this.inbox.claim(SEPAY_PROVIDER, deliveryId, manager, {
                    insert: INSERT_SEPAY_TRANSACTION,
                    payload: body,
                }))
            )
                return
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
            const [pending] = await manager.query<Array<PendingSepayReceipt>>(FIND_PENDING_SEPAY_INBOX, [
                message.deliveryId,
            ])
            if (pending === undefined) return
            await this.settle(manager, sepayPayloadOf(pending.payload))
            await manager.query(COMPLETE_SEPAY_TRANSACTION, [pending.id])
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
