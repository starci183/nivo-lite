import type { KnowledgeUsageView } from "@modules/domain/brain"
import type { KnowledgeUsageRequest } from "../../application/knowledge-usage.contracts"
import type { KnowledgeUsageType } from "./dto/knowledge-usage.type"

/** Maps the workspace of the call to the request. */
export const toKnowledgeUsageRequest = (workspaceId: string): KnowledgeUsageRequest => ({ workspaceId })

/** Maps the answer to the GraphQL type. */
export const toKnowledgeUsageType = (result: KnowledgeUsageView): KnowledgeUsageType => ({
    usedBytes: result.usedBytes,
    limitBytes: result.limitBytes,
    usedMb: result.usedMb,
    limitMb: result.limitMb,
    truthsInForce: result.truthsInForce,
    truthsCeiling: result.truthsCeiling,
    truthBytes: result.truthBytes,
    truthBytesCeiling: result.truthBytesCeiling,
    documents: {
        ...result.documents,
        areas: { public: { ...result.documents.areas.public }, internal: { ...result.documents.areas.internal } },
    },
    truths: { ...result.truths },
})
