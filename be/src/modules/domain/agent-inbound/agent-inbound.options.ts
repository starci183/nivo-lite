import type { Type } from "@nestjs/common"
import type { InboundStopReporter } from "./agent-inbound-door.contracts"

/** What the app root decides for the agent-inbound capability. */
export interface AgentInboundOptions {
    /** The class that tells a person a chain of agents stopped (the Office), reused as it is registered. */
    readonly stopReporter?: Type<InboundStopReporter>
}
