import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeUsageView } from "@modules/domain/brain"
import type { KnowledgeUsageRequest } from "./knowledge-usage.contracts"

/** Asks how much of its raw document allowance the workspace has used, and its truths in force against their ceiling. */
export class KnowledgeUsageQuery extends Query<KnowledgeUsageView> {
    constructor(readonly params: ExecuteParams<KnowledgeUsageRequest>) {
        super()
    }
}
