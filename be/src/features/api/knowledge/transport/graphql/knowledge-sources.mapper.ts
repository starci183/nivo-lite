import type { KnowledgeSourcesRequest } from "../../application/knowledge-sources.contracts"
import type { SourceSummary } from "@modules/domain/knowledge-sources"
import type { KnowledgeSourcesInput } from "./dto/knowledge-sources.input"
import type { KnowledgeSourceType } from "./dto/knowledge-source.type"
import { toKnowledgeSourceType } from "./knowledge-records.mapper"

/** Maps the GraphQL input to the request. */
export const toKnowledgeSourcesRequest = (
    workspaceId: string,
    input: KnowledgeSourcesInput,
): KnowledgeSourcesRequest => ({
    workspaceId,
    module: input.module,
})

/** Maps the answer to the GraphQL type. */
export const toKnowledgeSourcesType = (result: ReadonlyArray<SourceSummary>): Array<KnowledgeSourceType> =>
    result.map((source) => toKnowledgeSourceType(source))
