import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KnowledgeSourceRead, KnowledgeSourceRequest } from "./knowledge-source.contracts"

/** Reads one document of the workspace with its text and its passages. */
export class KnowledgeSourceQuery extends Query<KnowledgeSourceRead> {
    constructor(readonly params: ExecuteParams<KnowledgeSourceRequest>) {
        super()
    }
}
