import { CommandHandler } from "@nestjs/cqrs"
import { AutomationReactionsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReactToOrderShippedCommand } from "./react-to-order-shipped.command"

@CommandHandler(ReactToOrderShippedCommand)
/** Hands the delivered order_shipped event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class ReactToOrderShippedHandler extends ICQRSHandler<ReactToOrderShippedCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: AutomationReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: ReactToOrderShippedCommand): Promise<void> {
        return this.reactions.onOrderShipped(command.params.request.delivery)
    }
}
