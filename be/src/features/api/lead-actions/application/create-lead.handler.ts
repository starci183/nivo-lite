import { CommandHandler } from "@nestjs/cqrs"
import { LeadActionsService } from "@modules/domain/lead-actions"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateLeadCommand } from "./create-lead.command"

@CommandHandler(CreateLeadCommand)
/** Creates a customer through the core queued capture flow. */
export class CreateLeadHandler extends ICQRSHandler<CreateLeadCommand, LeadActionQueued> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadActions: LeadActionsService,
    ) {
        super(logger)
    }

    protected override process(command: CreateLeadCommand): Promise<LeadActionQueued> {
        return this.leadActions.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            "create",
            command.params.request.input,
            command.params.request.acceptLanguage,
        )
    }
}
