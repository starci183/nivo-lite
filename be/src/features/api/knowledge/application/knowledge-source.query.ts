import { Query } from "@nestjs/cqrs"
import type { OpenedKnowledgeSource } from "@modules/domain/knowledge"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeSourceRequest } from "./knowledge-source.contracts"

/** Reads one document of the workspace with its text and its passages. */
export class KnowledgeSourceQuery extends Query<OpenedKnowledgeSource> {
    constructor(readonly params: ExecuteParams<KnowledgeSourceRequest>) {
        super()
    }
}
