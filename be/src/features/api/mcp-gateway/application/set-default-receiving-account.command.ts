import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetDefaultReceivingAccountRequest } from "./set-default-receiving-account.contracts"

/** Names the payment account the shop receives money on by default. */
export class SetDefaultReceivingAccountCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetDefaultReceivingAccountRequest>) {
        super()
    }
}
