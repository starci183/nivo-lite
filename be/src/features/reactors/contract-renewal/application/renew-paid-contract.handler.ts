import { CommandHandler } from "@nestjs/cqrs"
import { ContractRenewalService } from "@modules/domain/contracts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RenewPaidContractCommand } from "./renew-paid-contract.command"

@CommandHandler(RenewPaidContractCommand)
/** Hands the delivered payment_reconciled event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class RenewPaidContractHandler extends ICQRSHandler<RenewPaidContractCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly renewal: ContractRenewalService,
    ) {
        super(logger)
    }

    protected override process(command: RenewPaidContractCommand): Promise<void> {
        return this.renewal.renewForPaidInvoice(
            command.params.request.delivery.consumer,
            command.params.request.delivery.dedupeKey,
            command.params.request.delivery.event.payload,
        )
    }
}
