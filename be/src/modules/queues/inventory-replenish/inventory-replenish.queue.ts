import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the replenish-stock job (the durable queue name). */
export const INVENTORY_REPLENISH_QUEUE = "inventory_replenish"

/** The payload of one replenish-stock job: the items whose stock just moved, ids only. */
export interface ReplenishPayload {
    /** The workspace the items belong to. */
    readonly workspaceId: string
    /** The items that may have fallen to their reorder point. */
    readonly itemIds: ReadonlyArray<string>
}

/** True when a job payload is the payload of a replenish-stock job. */
export const isReplenishPayload = (value: unknown): value is ReplenishPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "itemIds" in value &&
    Array.isArray(value.itemIds) &&
    value.itemIds.every((id: unknown) => typeof id === "string")

@Injectable()
/** The typed producer of the inventory-replenish queue: the one way a replenish-stock job starts. */
export class InventoryReplenishQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the low-stock check of the moved items in the caller's transaction. */
    enqueueReplenish(payload: ReplenishPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, INVENTORY_REPLENISH_QUEUE, payload)
    }
}
