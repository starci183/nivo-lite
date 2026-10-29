import type { InboundStatus, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import type { OptionalText, OutboundAccess } from "./work-engine.contracts"

/** The one door to the channel inputs: the engine reports where an input stands. The app root binds it to the inbox capability. */
export interface InboundEventStatus {
    /** Sets the status of an inbound event; `leadId` links the customer the engine found when it is not null. */
    mark(ctx: WorkContext, inboundEventId: string, status: InboundStatus, leadId: OptionalText): Promise<void>
}

/** The one door to the lead generation flow, whose steps chain by their own state machine. */
export interface LeadGenFlow {
    /** Queues what follows a finished lead generation item. */
    continueAfter(ctx: WorkContext, item: WorkItem): Promise<void>
}

/** The customer a lead names, as a decision note quotes it. */
export interface DecisionLead {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The channel label. */
    readonly channel: string
}

/** The one door to the leads: the decision log names the customer of a settled card. The app root binds it to the leads capability. */
export interface LeadDirectory {
    /** One lead of the workspace; an unknown or foreign id raises the owner's not-found error. */
    require(workspaceId: string, leadId: string): Promise<DecisionLead>
}

/** The one door to the channel connections: how far the item's agent may act on the connection the message would leave through. */
export interface OutboundAccessGate {
    /**
     * The access of the item's department agent on the connection of the conversation named in the proposal, else of the
     * customer's latest conversation; "auto" when there is no connection (website chat) or nothing is bound.
     */
    accessOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<OutboundAccess>
}
