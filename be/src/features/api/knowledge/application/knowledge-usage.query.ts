import { Query } from "@nestjs/cqrs"
import type { KnowledgeUsage } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeUsageRequest } from "./knowledge-usage.contracts"

/** Asks how much of its raw document allowance the workspace has used. */
export class KnowledgeUsageQuery extends Query<KnowledgeUsage> {
    constructor(readonly params: ExecuteParams<KnowledgeUsageRequest>) {
        super()
    }
}
