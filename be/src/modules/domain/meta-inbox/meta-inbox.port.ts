import type { MetaDeliveryRecorded } from "./meta-inbox.contracts"

/** Resolves a committed Meta receipt after its worker fence has been recorded. */
export interface MetaReceiptProcessor {
    /** Consumes the durable receipt reference, propagating failures for retry. */
    processRecordedDelivery(message: MetaDeliveryRecorded): Promise<void>
}
