import { CommandHandler } from "@nestjs/cqrs"
import { AutomationReactionsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReactToLeadCapturedCommand } from "./react-to-lead-captured.command"

@CommandHandler(ReactToLeadCapturedCommand)
/** Hands the delivered lead_captured event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class ReactToLeadCapturedHandler extends ICQRSHandler<ReactToLeadCapturedCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: AutomationReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: ReactToLeadCapturedCommand): Promise<void> {
        return this.reactions.onLeadCaptured(command.params.request.delivery)
    }
}
