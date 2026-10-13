import { Command } from "@nestjs/cqrs"
import type { ContentAiRequested } from "@modules/domain/content-ai"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestContentMonthPlanRequest } from "./request-content-month-plan.contracts"

/** Enqueues the requested content operation. */
export class RequestContentMonthPlanCommand extends Command<ContentAiRequested> {
    constructor(readonly params: ExecuteParams<RequestContentMonthPlanRequest>) {
        super()
    }
}
