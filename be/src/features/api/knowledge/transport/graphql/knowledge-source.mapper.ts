import type { KnowledgeSourceRead } from "@modules/domain/knowledge"
import type { KnowledgeSourceRequest } from "../../application/knowledge-source.contracts"
import type { KnowledgeSourceInput } from "./dto/knowledge-source.input"
import type { KnowledgeSourceDetailType } from "./dto/knowledge-source-detail.type"
import { toKnowledgeSourceTextType } from "./knowledge-records.mapper"

/** Maps the GraphQL input to the request. */
export const toKnowledgeSourceRequest = (workspaceId: string, input: KnowledgeSourceInput): KnowledgeSourceRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the answer to the GraphQL type. */
export const toKnowledgeSourceType = (result: KnowledgeSourceRead): KnowledgeSourceDetailType => ({
    source: toKnowledgeSourceTextType(result.source),
    chunks: result.chunks.map((chunk) => ({ ...chunk })),
    aiCost: result.aiCost,
})
