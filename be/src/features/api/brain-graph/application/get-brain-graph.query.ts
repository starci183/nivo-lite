import { Query } from "@nestjs/cqrs"
import type { BrainGraph } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBrainGraphRequest } from "./get-brain-graph.contracts"

/** Reads one page of the truth graph. */
export class GetBrainGraphQuery extends Query<BrainGraph> {
    constructor(readonly params: ExecuteParams<GetBrainGraphRequest>) {
        super()
    }
}
