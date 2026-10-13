import type { RetryKnowledgeSourceRequest } from "../../application/retry-knowledge-source.contracts"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { RetryKnowledgeSourceInput } from "./dto/retry-knowledge-source.input"
import type { SourceRefType } from "./dto/source-ref.type"

/** Maps the GraphQL input to the request. */
export const toRetryKnowledgeSourceRequest = (workspaceId: string, input: RetryKnowledgeSourceInput): RetryKnowledgeSourceRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the answer to the GraphQL type. */
export const toRetryKnowledgeSourceType = (result: SourceRef): SourceRefType => ({ id: result.id })
