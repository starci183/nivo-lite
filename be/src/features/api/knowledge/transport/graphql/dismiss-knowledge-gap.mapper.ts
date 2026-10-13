import type { DismissKnowledgeGapRequest } from "../../application/dismiss-knowledge-gap.contracts"
import type { DismissKnowledgeGapInput } from "./dto/dismiss-knowledge-gap.input"

/** Maps the GraphQL input to the request. */
export const toDismissKnowledgeGapRequest = (
    workspaceId: string,
    input: DismissKnowledgeGapInput,
): DismissKnowledgeGapRequest => ({
    workspaceId,
    id: input.id,
})
