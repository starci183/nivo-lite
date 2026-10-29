import { CommandHandler } from "@nestjs/cqrs"
import { BankCreditSettlementService } from "@modules/domain/work-performers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SettleBankCreditCommand } from "./settle-bank-credit.command"

@CommandHandler(SettleBankCreditCommand)
/** Hands the delivered bank_credit_booked event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class SettleBankCreditHandler extends ICQRSHandler<SettleBankCreditCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settlement: BankCreditSettlementService,
    ) {
        super(logger)
    }

    protected override process(command: SettleBankCreditCommand): Promise<void> {
        return this.settlement.settle(
            command.params.request.delivery.consumer,
            command.params.request.delivery.dedupeKey,
            command.params.request.delivery.event.payload,
        )
    }
}
