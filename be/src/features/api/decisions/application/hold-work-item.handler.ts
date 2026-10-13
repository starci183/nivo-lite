import { CommandHandler } from "@nestjs/cqrs"
import { WorkPlacementService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HoldWorkItemCommand } from "./hold-work-item.command"

@CommandHandler(HoldWorkItemCommand)
/** Keeps a waiting work item waiting and records the note. */
export class HoldWorkItemHandler extends ICQRSHandler<HoldWorkItemCommand, WorkItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly placement: WorkPlacementService,
    ) {
        super(logger)
    }

    protected override process(command: HoldWorkItemCommand): Promise<WorkItem> {
        return this.placement.hold(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
