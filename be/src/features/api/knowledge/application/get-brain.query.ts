import { Query } from "@nestjs/cqrs"
import type { BrainOverview } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBrainRequest } from "./get-brain.contracts"

/** Reads everything the Second Brain page shows. */
export class GetBrainQuery extends Query<BrainOverview> {
    constructor(readonly params: ExecuteParams<GetBrainRequest>) {
        super()
    }
}
