import type { KnowledgeUsage } from "@modules/domain/knowledge-sources"
import type { KnowledgeUsageRequest } from "../../application/knowledge-usage.contracts"
import type { KnowledgeUsageType } from "./dto/knowledge-usage.type"

/** Maps the workspace of the call to the request. */
export const toKnowledgeUsageRequest = (workspaceId: string): KnowledgeUsageRequest => ({ workspaceId })

/** Maps the answer to the GraphQL type. */
export const toKnowledgeUsageType = (result: KnowledgeUsage): KnowledgeUsageType => ({
    usedBytes: result.usedBytes,
    limitBytes: result.limitBytes,
})
