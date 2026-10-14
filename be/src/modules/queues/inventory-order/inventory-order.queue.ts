import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the deduct-order job (a pgmq queue name). */
export const INVENTORY_ORDER_QUEUE = "inventory_order"

/** The payload of one deduct-order job: a confirmed order whose goods leave stock. */
export interface DeductOrderPayload {
    /** The workspace the order belongs to. */
    readonly workspaceId: string
    /** The order id: the idempotency key of the deduction. */
    readonly orderId: string
    /** The order number shown to people. */
    readonly orderNo: string
    /** The ordered items as the customer wrote them. */
    readonly items: string
}

const ORDER_TEXT = ["workspaceId", "orderId", "orderNo", "items"] as const

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** True when every named field of a record is text. */
const textFields = (value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean =>
    keys.every((key) => typeof value[key] === "string")

/** True when a job payload is the payload of a deduct-order job. */
export const isDeductOrderPayload = (value: unknown): value is DeductOrderPayload =>
    isRecord(value) && textFields(value, ORDER_TEXT)

@Injectable()
/** The typed producer of the inventory-order queue: the one way a deduct-order job starts. */
export class InventoryOrderQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the stock deduction of a confirmed order in the caller's transaction. */
    enqueueDeductOrder(payload: DeductOrderPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, INVENTORY_ORDER_QUEUE, payload)
    }
}
