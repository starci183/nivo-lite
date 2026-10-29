import { CommandHandler } from "@nestjs/cqrs"
import { AutomationReactionsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SendPaymentReceiptCommand } from "./send-payment-receipt.command"

@CommandHandler(SendPaymentReceiptCommand)
/** Hands the delivered payment_reconciled event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class SendPaymentReceiptHandler extends ICQRSHandler<SendPaymentReceiptCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: AutomationReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: SendPaymentReceiptCommand): Promise<void> {
        return this.reactions.onPaymentReceipt(command.params.request.delivery)
    }
}
