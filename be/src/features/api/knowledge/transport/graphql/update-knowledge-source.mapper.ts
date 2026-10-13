import type { UpdateKnowledgeSourceRequest } from "../../application/update-knowledge-source.contracts"
import type { UpdateKnowledgeSourceInput } from "./dto/update-knowledge-source.input"

/** Maps the GraphQL input to the request. */
export const toUpdateKnowledgeSourceRequest = (workspaceId: string, input: UpdateKnowledgeSourceInput): UpdateKnowledgeSourceRequest => ({
    workspaceId,
    sourceId: input.sourceId,
    title: input.title,
    topic: input.topic,
    tags: input.tags,
    module: input.module,
    visibility: input.visibility,
})
