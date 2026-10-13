import { Query } from "@nestjs/cqrs"
import type { NivoEntry } from "@modules/domain/nivo-knowledge"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { NivoKnowledgeRequest } from "./nivo-knowledge.contracts"

/** Lists the base knowledge of NIVO, which every signed-in person may read. */
export class NivoKnowledgeQuery extends Query<ReadonlyArray<NivoEntry>> {
    constructor(readonly params: ExecuteParams<NivoKnowledgeRequest>) {
        super()
    }
}
