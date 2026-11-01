import type { BulkUndone } from "@modules/domain/brain"
import type { UndoBrainFactBatchRequest } from "../../application/undo-brain-fact-batch.contracts"
import type { BrainBulkUndoneType } from "./dto/brain-bulk-undone.type"
import type { UndoBrainFactBatchInput } from "./dto/undo-brain-fact-batch.input"

/** Maps the GraphQL input to the request. */
export const toUndoBrainFactBatchRequest = (
    workspaceId: string,
    input: UndoBrainFactBatchInput,
): UndoBrainFactBatchRequest => ({ workspaceId, batchId: input.batchId })

/** Maps the answer to the GraphQL type. */
export const toBrainBulkUndoneType = (result: BulkUndone): BrainBulkUndoneType => ({
    restored: result.restored,
    kept: result.kept,
})
