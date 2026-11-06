import type { ModuleDefinition } from "@modules/domain/modules"
import type { InboundStatus, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import type { OptionalText, OutboundAccess } from "./work-engine.contracts"

/** The one door to the channel inputs: the engine reports where an input stands. The app root binds it to the inbox capability. */
export interface InboundEventStatus {
    /** Sets the status of an inbound event; `leadId` links the customer the engine found when it is not null. */
    mark(ctx: WorkContext, inboundEventId: string, status: InboundStatus, leadId: OptionalText): Promise<void>
}

/** The one door to the channel connections: how far the item's agent may act on the connection the message would leave through. */
export interface OutboundAccessGate {
    /**
     * The access of the item's department agent on the connection of the conversation named in the proposal, else of the
     * customer's latest conversation; "auto" when there is no connection (website chat) or nothing is bound.
     */
    accessOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<OutboundAccess>
}

/** The one door to the catalogue of modules: which modules exist and which actions each performs. The app root binds it to the modules capability. */
export interface ModuleCatalogSource {
    /** The catalogue, its modules in display order. */
    catalog(): Promise<{ readonly modules: ReadonlyArray<ModuleDefinition> }>
}

/** How a work item closed by a person's decision. */
export type ClosedOutcome = "approved" | "rejected"

/** Told when a work item closes by a person's decision, so whatever waits on it can go on; the app root binds it, and with none bound nothing waits. */
export interface WorkItemClosedHook {
    /** The item closed approved or rejected. A throw is logged and the decision stands: whoever waits recovers from the item itself. */
    closed(workspaceId: string, workItemId: string, outcome: ClosedOutcome, by: string): Promise<void>
}
