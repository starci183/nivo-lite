import type { GetBrainRequest } from "../../application/get-brain.contracts"
import type { BrainOverview } from "@modules/domain/brain"
import type { BrainType } from "./dto/brain.type"
import type { BrainFactsPageInput } from "./dto/brain-facts-page.input"
import { toBrainType } from "./brain-records.mapper"

/** Maps the workspace of the call, and the page of facts it asks for (none: the first page as before), to the request. */
export const toGetBrainRequest = (workspaceId: string, facts?: BrainFactsPageInput | null): GetBrainRequest =>
    ({ workspaceId, facts })

/** Maps the answer to the GraphQL type. */
export const toGetBrainType = (result: BrainOverview): BrainType => toBrainType(result)
