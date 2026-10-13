import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { NivoKnowledgeCountRequest } from "./nivo-knowledge-count.contracts"

/** Asks how many base-knowledge items a module runs on. */
export class NivoKnowledgeCountQuery extends Query<number> {
    constructor(readonly params: ExecuteParams<NivoKnowledgeCountRequest>) {
        super()
    }
}
