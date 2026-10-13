import { CommandHandler } from "@nestjs/cqrs"
import { LeadActionsService } from "@modules/domain/lead-actions"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SettleWonDealCommand } from "./settle-won-deal.command"

@CommandHandler(SettleWonDealCommand)
/** Queues the accounting handoff of a won deal. */
export class SettleWonDealHandler extends ICQRSHandler<SettleWonDealCommand, LeadActionQueued> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadActions: LeadActionsService,
    ) {
        super(logger)
    }

    protected override process(command: SettleWonDealCommand): Promise<LeadActionQueued> {
        return this.leadActions.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            "settle-won",
            command.params.request.input,
            command.params.request.acceptLanguage,
        )
    }
}
