import { CommandHandler } from "@nestjs/cqrs"
import { LeadActionsService } from "@modules/domain/lead-actions"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RefreshLeadContextCommand } from "./refresh-lead-context.command"

@CommandHandler(RefreshLeadContextCommand)
/** Queues the refresh of the lead's sales context. */
export class RefreshLeadContextHandler extends ICQRSHandler<RefreshLeadContextCommand, LeadActionQueued> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadActions: LeadActionsService,
    ) {
        super(logger)
    }

    protected override process(command: RefreshLeadContextCommand): Promise<LeadActionQueued> {
        return this.leadActions.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            "refresh-context",
            command.params.request.input,
            command.params.request.acceptLanguage,
        )
    }
}
