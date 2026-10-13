import { CommandHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OrderPlanCommand } from "./order-plan.command"

@CommandHandler(OrderPlanCommand)
/** Creates the payment order through the billing service, which admits owner and manager only. */
export class OrderPlanHandler extends ICQRSHandler<OrderPlanCommand, PayableOrder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override process(command: OrderPlanCommand): Promise<PayableOrder> {
        return this.billing.orderPlan(command.params.principal.id, command.params.request)
    }
}
