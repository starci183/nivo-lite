import { CommandHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AssignWorkItemCommand } from "./assign-work-item.command"

@CommandHandler(AssignWorkItemCommand)
/** Gives a work item to a staff member through the decisions service. */
export class AssignWorkItemHandler extends ICQRSHandler<AssignWorkItemCommand, WorkItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: AssignWorkItemCommand): Promise<WorkItem> {
        return this.decisions.assignWorkItem(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.workItemId,
            command.params.request.staffId,
        )
    }
}
