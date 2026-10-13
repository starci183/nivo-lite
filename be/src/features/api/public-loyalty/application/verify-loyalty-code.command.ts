import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { VerifyLoyaltyCodeRequest, VerifyLoyaltyCodeResult } from "./verify-loyalty-code.contracts"

/** Shows the points once the code is right. */
export class VerifyLoyaltyCodeCommand extends Command<VerifyLoyaltyCodeResult> {
    constructor(readonly params: PublicExecuteParams<VerifyLoyaltyCodeRequest>) {
        super()
    }
}
