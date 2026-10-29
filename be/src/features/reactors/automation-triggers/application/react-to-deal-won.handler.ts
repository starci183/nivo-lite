import { CommandHandler } from "@nestjs/cqrs"
import { AutomationReactionsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReactToDealWonCommand } from "./react-to-deal-won.command"

@CommandHandler(ReactToDealWonCommand)
/** Hands the delivered deal_won event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class ReactToDealWonHandler extends ICQRSHandler<ReactToDealWonCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: AutomationReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: ReactToDealWonCommand): Promise<void> {
        return this.reactions.onDealWon(command.params.request.delivery)
    }
}
