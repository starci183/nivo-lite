import { CommandHandler } from "@nestjs/cqrs"
import { LeadActionsService } from "@modules/domain/lead-actions"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DraftLeadExecutionCommand } from "./draft-lead-execution.command"

@CommandHandler(DraftLeadExecutionCommand)
/** Queues a draft execution plan for the lead. */
export class DraftLeadExecutionHandler extends ICQRSHandler<DraftLeadExecutionCommand, LeadActionQueued> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadActions: LeadActionsService,
    ) {
        super(logger)
    }

    protected override process(command: DraftLeadExecutionCommand): Promise<LeadActionQueued> {
        return this.leadActions.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            "draft-execution",
            command.params.request.input,
            command.params.request.acceptLanguage,
        )
    }
}
