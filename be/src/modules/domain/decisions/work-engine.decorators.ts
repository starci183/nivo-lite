import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type {
    DecisionEvents,
    InboundEventStatus,
    LeadDirectory,
    LeadGenFlow,
    OutboundAccessGate,
    PaymentReceipts,
} from "./work-engine.port"

/** Token of the inbound event status port; the app root binds it to the inbox capability. */
export const INBOUND_EVENT_STATUS: unique symbol = Symbol("domain.decisions.inbound-event-status")

/** Token of the outbound decision events port. */
export const DECISION_EVENTS: unique symbol = Symbol("domain.decisions.decision-events")

/** Token of the payment receipt port. */
export const PAYMENT_RECEIPTS: unique symbol = Symbol("domain.decisions.payment-receipts")

/** Token of the lead generation flow port. */
export const LEAD_GEN_FLOW: unique symbol = Symbol("domain.decisions.lead-gen-flow")

/** Token of the lead directory port. */
export const LEAD_DIRECTORY: unique symbol = Symbol("domain.decisions.lead-directory")

/** Token of the outbound access port. */
export const OUTBOUND_ACCESS_GATE: unique symbol = Symbol("domain.decisions.outbound-access-gate")

/** Injects the inbound event status port. Parameter type: InboundEventStatus. */
export const InjectInboundEventStatus = (): TypedParameterDecorator<InboundEventStatus> =>
    injector<InboundEventStatus>(INBOUND_EVENT_STATUS)

/** Injects the outbound decision events port. Parameter type: DecisionEvents. */
export const InjectDecisionEvents = (): TypedParameterDecorator<DecisionEvents> =>
    injector<DecisionEvents>(DECISION_EVENTS)

/** Injects the payment receipt port. Parameter type: PaymentReceipts. */
export const InjectPaymentReceipts = (): TypedParameterDecorator<PaymentReceipts> =>
    injector<PaymentReceipts>(PAYMENT_RECEIPTS)

/** Injects the lead generation flow port. Parameter type: LeadGenFlow. */
export const InjectLeadGenFlow = (): TypedParameterDecorator<LeadGenFlow> => injector<LeadGenFlow>(LEAD_GEN_FLOW)

/** Injects the outbound access port. Parameter type: OutboundAccessGate. */
export const InjectOutboundAccessGate = (): TypedParameterDecorator<OutboundAccessGate> =>
    injector<OutboundAccessGate>(OUTBOUND_ACCESS_GATE)

/** Injects the lead directory port. Parameter type: LeadDirectory. */
export const InjectLeadDirectory = (): TypedParameterDecorator<LeadDirectory> => injector<LeadDirectory>(LEAD_DIRECTORY)
