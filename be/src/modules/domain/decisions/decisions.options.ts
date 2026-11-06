import type { InjectionToken, Type } from "@nestjs/common"
import type { InboundEventStatus, ModuleCatalogSource, OutboundAccessGate } from "./work-engine.port"

/** The owners of the ports the work engine reads and calls through: the app root names a class for each one. */
export interface DecisionsPorts {
    /** Provider that tells which agent speaks for a department (the agents capability). */
    readonly agentDirectory: InjectionToken
    /** Marks the status of the inbound event behind an item (the inbox lane). */
    readonly inboundEventStatus: Type<InboundEventStatus>
    /** Serves the catalogue of modules (the modules capability, a global provider the port reuses). */
    readonly moduleCatalog: Type<ModuleCatalogSource>
    /** Reads the access of an agent on a connection (the connections lane). */
    readonly outboundAccessGate: Type<OutboundAccessGate>
}

/** What the decisions capability needs from the app root. */
export interface DecisionsOptions {
    /** The owners of its ports. */
    readonly ports: DecisionsPorts
}
