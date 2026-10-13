import { Query } from "@nestjs/cqrs"
import type { Passage } from "@modules/domain/knowledge"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AskKnowledgeRequest } from "./ask-knowledge.contracts"

/** Tries a question against what an agent would retrieve. */
export class AskKnowledgeQuery extends Query<ReadonlyArray<Passage>> {
    constructor(readonly params: ExecuteParams<AskKnowledgeRequest>) {
        super()
    }
}
