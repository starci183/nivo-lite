import { CommandHandler } from "@nestjs/cqrs"
import { AutomationReactionsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReactToPaymentReconciledCommand } from "./react-to-payment-reconciled.command"

@CommandHandler(ReactToPaymentReconciledCommand)
/** Hands the delivered payment_reconciled event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class ReactToPaymentReconciledHandler extends ICQRSHandler<ReactToPaymentReconciledCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: AutomationReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: ReactToPaymentReconciledCommand): Promise<void> {
        return this.reactions.onPaymentReconciled(command.params.request.delivery)
    }
}
