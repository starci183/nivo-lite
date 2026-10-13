import { Query } from "@nestjs/cqrs"
import type { SourceSummary } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeSourcesRequest } from "./knowledge-sources.contracts"

/** Lists the documents of the workspace, newest first and without their text. */
export class KnowledgeSourcesQuery extends Query<ReadonlyArray<SourceSummary>> {
    constructor(readonly params: ExecuteParams<KnowledgeSourcesRequest>) {
        super()
    }
}
