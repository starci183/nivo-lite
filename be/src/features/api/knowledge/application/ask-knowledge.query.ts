import { Query } from "@nestjs/cqrs"
import type { Passage } from "@modules/domain/knowledge"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AskKnowledgeRequest } from "./ask-knowledge.contracts"

/** Asks what an agent would retrieve for a question. */
export class AskKnowledgeQuery extends Query<ReadonlyArray<Passage>> {
    constructor(readonly params: ExecuteParams<AskKnowledgeRequest>) {
        super()
    }
}
