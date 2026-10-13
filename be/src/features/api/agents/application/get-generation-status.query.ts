import { Query } from "@nestjs/cqrs"
import type { GenerationStatus } from "@modules/domain/ai-generations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetGenerationStatusRequest } from "./get-generation-status.contracts"

/** Asks where a queued text stands. */
export class GetGenerationStatusQuery extends Query<GenerationStatus> {
    constructor(readonly params: ExecuteParams<GetGenerationStatusRequest>) {
        super()
    }
}
