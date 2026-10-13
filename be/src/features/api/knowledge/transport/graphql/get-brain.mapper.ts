import type { GetBrainRequest } from "../../application/get-brain.contracts"
import type { BrainOverview } from "@modules/domain/brain"
import type { BrainType } from "./dto/brain.type"
import { toBrainType } from "./brain-records.mapper"

/** Maps the workspace of the call to the request. */
export const toGetBrainRequest = (workspaceId: string): GetBrainRequest => ({ workspaceId })

/** Maps the answer to the GraphQL type. */
export const toGetBrainType = (result: BrainOverview): BrainType => toBrainType(result)
