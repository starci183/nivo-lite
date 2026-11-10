import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeSourceListing, KnowledgeSourcesRequest } from "./knowledge-sources.contracts"

/** Lists the documents of the workspace, newest first and without their text. */
export class KnowledgeSourcesQuery extends Query<ReadonlyArray<KnowledgeSourceListing>> {
    constructor(readonly params: ExecuteParams<KnowledgeSourcesRequest>) {
        super()
    }
}
