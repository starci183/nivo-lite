import type { DeleteKnowledgeSourceRequest } from "../../application/delete-knowledge-source.contracts"
import type { DeleteKnowledgeSourceInput } from "./dto/delete-knowledge-source.input"

/** Maps the GraphQL input to the request. */
export const toDeleteKnowledgeSourceRequest = (workspaceId: string, input: DeleteKnowledgeSourceInput): DeleteKnowledgeSourceRequest => ({
    workspaceId,
    id: input.id,
})
