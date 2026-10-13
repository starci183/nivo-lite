import type { InboxSimulationStatus } from "@modules/domain/inbox-simulation"
import type { GetInboundSimulationStatusRequest } from "../../application/get-inbound-simulation-status.contracts"
import type { InboundSimulationStatusInput } from "./dto/inbound-simulation-status.input"
import type { InboundSimulationStatusType } from "./dto/inbound-simulation-status.type"

/** Maps a selected workspace and the event identity to the status query. */
export const toInboundSimulationStatusRequest = (
    workspaceId: string,
    input: InboundSimulationStatusInput,
): GetInboundSimulationStatusRequest => ({ workspaceId, id: input.id })

/** Maps the status and its nested result facts to the GraphQL types. */
export const toInboundSimulationStatusType = (result: InboxSimulationStatus): InboundSimulationStatusType => ({
    ...result,
})
