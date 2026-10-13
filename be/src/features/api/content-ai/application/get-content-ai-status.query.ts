import { Query } from "@nestjs/cqrs"
import type { ContentAiStatus } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetContentAiStatusRequest } from "./get-content-ai-status.contracts"

/** Reads progress and a durable domain result. */
export class GetContentAiStatusQuery extends Query<ContentAiStatus> {
    constructor(readonly params: ExecuteParams<GetContentAiStatusRequest>) {
        super()
    }
}
