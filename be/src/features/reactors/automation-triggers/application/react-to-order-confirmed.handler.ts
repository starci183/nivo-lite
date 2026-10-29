import { CommandHandler } from "@nestjs/cqrs"
import { AutomationReactionsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReactToOrderConfirmedCommand } from "./react-to-order-confirmed.command"

@CommandHandler(ReactToOrderConfirmedCommand)
/** Hands the delivered order_confirmed event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class ReactToOrderConfirmedHandler extends ICQRSHandler<ReactToOrderConfirmedCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: AutomationReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: ReactToOrderConfirmedCommand): Promise<void> {
        return this.reactions.onOrderConfirmed(command.params.request.delivery)
    }
}
