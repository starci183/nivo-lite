import { CommandHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RenewPlanCommand } from "./renew-plan.command"

@CommandHandler(RenewPlanCommand)
/** Creates the renewal order through the billing service, which admits owner and manager only. */
export class RenewPlanHandler extends ICQRSHandler<RenewPlanCommand, PayableOrder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override process(command: RenewPlanCommand): Promise<PayableOrder> {
        return this.billing.renew(command.params.principal.id, command.params.request)
    }
}
