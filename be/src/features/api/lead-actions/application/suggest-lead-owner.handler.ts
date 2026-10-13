import { CommandHandler } from "@nestjs/cqrs"
import { LeadActionsService } from "@modules/domain/lead-actions"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SuggestLeadOwnerCommand } from "./suggest-lead-owner.command"

@CommandHandler(SuggestLeadOwnerCommand)
/** Queues a suggested owner for the lead. */
export class SuggestLeadOwnerHandler extends ICQRSHandler<SuggestLeadOwnerCommand, LeadActionQueued> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadActions: LeadActionsService,
    ) {
        super(logger)
    }

    protected override process(command: SuggestLeadOwnerCommand): Promise<LeadActionQueued> {
        return this.leadActions.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            "suggest-owner",
            command.params.request.input,
            command.params.request.acceptLanguage,
        )
    }
}
