import type { KnowledgeSourceListing } from "@modules/domain/brain"
import type { KnowledgeSourcesRequest } from "../../application/knowledge-sources.contracts"
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
    origin: input.origin,
})

/** Maps the answer to the GraphQL type; where the truths of a document stand travels as the domain names it. */
export const toKnowledgeSourcesType = (result: ReadonlyArray<KnowledgeSourceListing>): Array<KnowledgeSourceType> =>
    result.map(({ aiCost, ...source }) => ({ ...toKnowledgeSourceType(source), aiCost }))
