import { Command } from "@nestjs/cqrs"
import type { PayableOrder } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RenewPlanRequest } from "./renew-plan.contracts"

/** Asks for a payment order that renews the current plan of a workspace. */
export class RenewPlanCommand extends Command<PayableOrder> {
    constructor(readonly params: ExecuteParams<RenewPlanRequest>) {
        super()
    }
}
