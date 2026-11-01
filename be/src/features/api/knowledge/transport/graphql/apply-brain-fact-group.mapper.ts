import type { BulkApplied } from "@modules/domain/brain"
import type { ApplyBrainFactGroupRequest } from "../../application/apply-brain-fact-group.contracts"
import type { ApplyBrainFactGroupInput } from "./dto/apply-brain-fact-group.input"
import type { BrainBulkAppliedType } from "./dto/brain-bulk-applied.type"

/** Maps the GraphQL input to the request. */
export const toApplyBrainFactGroupRequest = (
    workspaceId: string,
    input: ApplyBrainFactGroupInput,
): ApplyBrainFactGroupRequest => ({ workspaceId, sourceId: input.sourceId })

/** Maps the answer to the GraphQL type. */
export const toBrainBulkAppliedType = (result: BulkApplied): BrainBulkAppliedType => ({
    batchId: result.batchId,
    applied: result.applied,
    skipped: result.skipped,
})
