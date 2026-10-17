import type { MetaDeliveryRecorded, MetaInboundJob } from "./meta-inbox.contracts"

/** Who takes a queued Meta event before the chatbot front door (the lead generation flow; the app root binds it). */
export interface MetaEventTaker {
    /** Takes the event when it is the taker's; false leaves it to the chatbot front door. */
    take(job: MetaInboundJob): Promise<boolean>
}

/** Resolves a committed Meta receipt after its worker fence has been recorded. */
export interface MetaReceiptProcessor {
    /** Consumes the durable receipt reference, propagating failures for retry. */
    processRecordedDelivery(message: MetaDeliveryRecorded): Promise<void>
}
