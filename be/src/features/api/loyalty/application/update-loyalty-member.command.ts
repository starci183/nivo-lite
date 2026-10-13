import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateCustomerParams, CustomerUpdateResult } from "./update-loyalty-member.contracts"

/** Requests update loyalty member for the current principal. */
export class UpdateLoyaltyMemberCommand extends Command<CustomerUpdateResult> {
    constructor(readonly params: ExecuteParams<UpdateCustomerParams>) {
        super()
    }
}
