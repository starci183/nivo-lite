import { Command } from "@nestjs/cqrs"
import type { PayableOrder } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { OrderPlanRequest } from "./order-plan.contracts"

/** Asks for the first payment order of a workspace for the plan it chose. */
export class OrderPlanCommand extends Command<PayableOrder> {
    constructor(readonly params: ExecuteParams<OrderPlanRequest>) {
        super()
    }
}
