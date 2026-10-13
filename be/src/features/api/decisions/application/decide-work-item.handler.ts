import { CommandHandler } from "@nestjs/cqrs"
import { WorkDecisionService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideWorkItemCommand } from "./decide-work-item.command"

@CommandHandler(DecideWorkItemCommand)
/** Resumes the work through the work decision service. */
export class DecideWorkItemHandler extends ICQRSHandler<DecideWorkItemCommand, WorkItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: WorkDecisionService,
    ) {
        super(logger)
    }

    protected override process(command: DecideWorkItemCommand): Promise<WorkItem> {
        return this.decisions.decide(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
