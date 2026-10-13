import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the reconcile-bank-credit job (a pgmq queue name). */
export const BANK_CREDIT_QUEUE = "bank_credit_received"

/** The payload of one reconcile-bank-credit job: ids and the amount only. */
export interface BankCreditPayload {
    /** The workspace the credit belongs to. */
    readonly workspaceId: string
    /** The inbound payment event the credit became. */
    readonly inboundEventId: string
    /** The credited amount in VND. */
    readonly amountVnd: number
}

/** True when a job payload is the payload of a reconcile-bank-credit job. */
export const isBankCreditPayload = (value: unknown): value is BankCreditPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "inboundEventId" in value &&
    typeof value.inboundEventId === "string" &&
    "amountVnd" in value &&
    typeof value.amountVnd === "number"

@Injectable()
/** The typed producer of the bank-credit queue: the one way a reconcile-bank-credit job starts. */
export class BankCreditQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the reconciliation of a new credit in the caller's transaction: the job exists exactly when the event commits. */
    enqueueBankCredit(payload: BankCreditPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, BANK_CREDIT_QUEUE, payload)
    }
}
