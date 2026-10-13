import type { MaintainBrainRequest } from "../../application/maintain-brain.contracts"

/** Maps the workspace of the call to the request. */
export const toMaintainBrainRequest = (workspaceId: string): MaintainBrainRequest => ({ workspaceId })
