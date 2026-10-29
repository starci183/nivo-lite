import { CommandHandler } from "@nestjs/cqrs"
import { AutomationReactionsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReactToDecisionMadeCommand } from "./react-to-decision-made.command"

@CommandHandler(ReactToDecisionMadeCommand)
/** Hands the delivered decision_made event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class ReactToDecisionMadeHandler extends ICQRSHandler<ReactToDecisionMadeCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: AutomationReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: ReactToDecisionMadeCommand): Promise<void> {
        return this.reactions.onDecisionMade(command.params.request.delivery)
    }
}
