import { CommandHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HoldWorkItemCommand } from "./hold-work-item.command"

@CommandHandler(HoldWorkItemCommand)
/** Keeps a waiting work item waiting through the decisions service. */
export class HoldWorkItemHandler extends ICQRSHandler<HoldWorkItemCommand, WorkItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: HoldWorkItemCommand): Promise<WorkItem> {
        return this.decisions.holdWorkItem(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.workItemId,
            command.params.request.note,
        )
    }
}
