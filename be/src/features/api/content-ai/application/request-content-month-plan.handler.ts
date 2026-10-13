import { CommandHandler } from "@nestjs/cqrs"
import { ContentAiService } from "@modules/domain/content-ai"
import type { ContentAiRequested } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestContentMonthPlanCommand } from "./request-content-month-plan.command"

@CommandHandler(RequestContentMonthPlanCommand)
/** Dispatches an authorized request to queued content work. */
export class RequestContentMonthPlanHandler extends ICQRSHandler<RequestContentMonthPlanCommand, ContentAiRequested> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(command: RequestContentMonthPlanCommand): Promise<ContentAiRequested> {
        return this.content.requestMonthPlan(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.month,
        )
    }
}
