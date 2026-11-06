import type { Type } from "@nestjs/common"
import type { FlowGate } from "./flows.contracts"

/** What the flows capability needs from the app root. */
export interface FlowsOptions {
    /** The class that runs a flow command (the flow engine), reused as it is registered. */
    readonly gate: Type<FlowGate>
}
