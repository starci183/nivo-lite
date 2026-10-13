import type { InjectionToken, Type } from "@nestjs/common"
import type {
    DecisionEvents,
    InboundEventStatus,
    LeadGenFlow,
    OutboundAccessGate,
    PaymentReceipts,
} from "./work-engine.port"

/** The owners of the ports the work engine reads and calls through: the app root names a class for each one. */
export interface DecisionsPorts {
    /** Provider that tells which agent speaks for a department (the agents capability). */
    readonly agentDirectory: InjectionToken
    /** Marks the status of the inbound event behind an item (the inbox lane). */
    readonly inboundEventStatus: Type<InboundEventStatus>
    /** Emits the outbound events of a decision (the automations lane). */
    readonly decisionEvents: Type<DecisionEvents>
    /** Triggers the receipt of a payment (the automations lane). */
    readonly paymentReceipts: Type<PaymentReceipts>
    /** Continues the lead generation flow after an item (the leads lane). */
    readonly leadGenFlow: Type<LeadGenFlow>
    /** Reads the access of an agent on a connection (the connections lane). */
    readonly outboundAccessGate: Type<OutboundAccessGate>
}

/** What the decisions capability needs from the app root. */
export interface DecisionsOptions {
    /** The owners of its ports. */
    readonly ports: DecisionsPorts
}
