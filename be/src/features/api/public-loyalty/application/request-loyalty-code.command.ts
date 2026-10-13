import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RequestLoyaltyCodeRequest, RequestLoyaltyCodeResult } from "./request-loyalty-code.contracts"

/** Asks for a code in the customer chat. */
export class RequestLoyaltyCodeCommand extends Command<RequestLoyaltyCodeResult> {
    constructor(readonly params: PublicExecuteParams<RequestLoyaltyCodeRequest>) {
        super()
    }
}
