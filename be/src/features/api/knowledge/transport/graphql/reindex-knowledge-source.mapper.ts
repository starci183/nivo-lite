import type { ReindexKnowledgeSourceRequest } from "../../application/reindex-knowledge-source.contracts"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { ReindexKnowledgeSourceInput } from "./dto/reindex-knowledge-source.input"
import type { SourceRefType } from "./dto/source-ref.type"

/** Maps the GraphQL input to the request. */
export const toReindexKnowledgeSourceRequest = (
    workspaceId: string,
    input: ReindexKnowledgeSourceInput,
): ReindexKnowledgeSourceRequest => ({
    workspaceId,
    sourceId: input.sourceId,
    content: input.content,
})

/** Maps the answer to the GraphQL type. */
export const toReindexKnowledgeSourceType = (result: SourceRef): SourceRefType => ({ id: result.id })
