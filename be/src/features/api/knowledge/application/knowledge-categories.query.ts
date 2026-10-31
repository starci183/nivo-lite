import { Query } from "@nestjs/cqrs"
import type { SourceCategory } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeCategoriesRequest } from "./knowledge-categories.contracts"

/** Asks what each category (topic) of the documents of the workspace holds. */
export class KnowledgeCategoriesQuery extends Query<ReadonlyArray<SourceCategory>> {
    constructor(readonly params: ExecuteParams<KnowledgeCategoriesRequest>) {
        super()
    }
}
