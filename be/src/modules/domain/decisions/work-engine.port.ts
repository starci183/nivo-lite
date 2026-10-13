import type { InboundStatus, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import type { DecisionPayload, OptionalText, OutboundAccess, PaymentReceiptRequest } from "./work-engine.contracts"

/** The one door to the channel inputs: the engine reports where an input stands. The app root binds it to the inbox capability. */
export interface InboundEventStatus {
    /** Sets the status of an inbound event; `leadId` links the customer the engine found when it is not null. */
    mark(ctx: WorkContext, inboundEventId: string, status: InboundStatus, leadId: OptionalText): Promise<void>
}

/** The one door to the outbound event stream (webhooks, n8n triggers). The app root binds it to the outbound-events capability. */
export interface DecisionEvents {
    /** Publishes `decision.made`; the dedupe key makes a redelivery publish once. */
    decisionMade(ctx: WorkContext, payload: DecisionPayload, dedupeKey: string): Promise<void>
}

/** The one door to the payment receipt pipeline. The app root binds it to the n8n triggers. */
export interface PaymentReceipts {
    /** Starts the customer's receipt by email, when the shop turned the pipeline on. */
    receiptFor(ctx: WorkContext, request: PaymentReceiptRequest): Promise<void>
}

/** The one door to the lead generation flow, whose steps chain by their own state machine. */
export interface LeadGenFlow {
    /** Queues what follows a finished lead generation item. */
    continueAfter(ctx: WorkContext, item: WorkItem): Promise<void>
}

/** The one door to the channel connections: how far the item's agent may act on the connection the message would leave through. */
export interface OutboundAccessGate {
    /**
     * The access of the item's department agent on the connection of the conversation named in the proposal, else of the
     * customer's latest conversation; "auto" when there is no connection (website chat) or nothing is bound.
     */
    accessOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<OutboundAccess>
}
