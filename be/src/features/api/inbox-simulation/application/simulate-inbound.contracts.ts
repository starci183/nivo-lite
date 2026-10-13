import type { InboxSimulationInput } from "@modules/domain/inbox-simulation"

/** The selected workspace and the simulator input, with its accepted request language. */
export interface SimulateInboundRequest {
    /** The workspace selected in the request header. */
    readonly workspaceId: string
    /** The simulated input the caller entered. */
    readonly simulation: InboxSimulationInput
}
