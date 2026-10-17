import type { ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"

/** The domain effect performed after a recorded delivery passes its worker fence. */
export interface ZaloDeliveryConsumer {
    /** Resolves and atomically processes a committed receipt. */
    processRecordedDelivery(message: ZaloDeliveryRecorded): Promise<void>
}
