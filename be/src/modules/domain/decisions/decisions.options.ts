import type { InjectionToken, Type } from "@nestjs/common"
import type { WorkItemsLeadDirectory } from "@modules/domain/work-items"
import type {
    InboundEventStatus,
    LeadDirectory,
    LeadGenFlow,
    ModuleCatalogSource,
    OutboundAccessGate,
    ThreadWorkHistory,
    WorkChainsHistory,
    WorkThreadsHistory,
} from "./work-engine.port"

/** The owners of the ports the work engine reads and calls through: the app root names a class for each one. */
export interface DecisionsPorts {
    /** Provider that tells which agent speaks for a department (the agents capability). */
    readonly agentDirectory: InjectionToken
    /** Marks the status of the inbound event behind an item (the inbox lane). */
    readonly inboundEventStatus: Type<InboundEventStatus>
    /** Names the customer of a lead (the leads capability), reused as it is registered. */
    readonly leadDirectory: Type<LeadDirectory>
    /** Names the customers of the work item lists (the leads capability), reused as it is registered. */
    readonly workItemLeads: Type<WorkItemsLeadDirectory>
    /** Continues the lead generation flow after an item (the lead-flows capability, a global provider the port reuses). */
    readonly leadGenFlow: Type<LeadGenFlow>
    /** Serves the catalogue of modules (the modules capability, a global provider the port reuses). */
    readonly moduleCatalog: Type<ModuleCatalogSource>
    /** Reads the access of an agent on a connection (the connections lane). */
    readonly outboundAccessGate: Type<OutboundAccessGate>
    /** Tells which approval requests and threads an agent's work runs in (the thread-work capability, a global provider the port reuses). */
    readonly threadWorkHistory: Type<ThreadWorkHistory>
    /** Names the thread of a step and lists the completed tasks (the work-chains capability, a global provider the port reuses). */
    readonly workChainsHistory: Type<WorkChainsHistory>
    /** Names the customer of a thread (the work-threads capability, a global provider the port reuses). */
    readonly workThreadsHistory: Type<WorkThreadsHistory>
}

/** What the decisions capability needs from the app root. */
export interface DecisionsOptions {
    /** The owners of its ports. */
    readonly ports: DecisionsPorts
}
