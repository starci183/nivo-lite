import type { MetaInboundJob } from "./meta-inbox.contracts"

/** Who takes a queued Meta event before the chatbot front door (the lead generation flow; the app root binds it). */
export interface MetaEventTaker {
    /** Takes the event when it is the taker's; false leaves it to the chatbot front door. */
    take(job: MetaInboundJob): Promise<boolean>
}
