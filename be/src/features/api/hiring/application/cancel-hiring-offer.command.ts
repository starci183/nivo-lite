import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CancelHiringOfferRequest } from "./cancel-hiring-offer.contracts"

/** Asks for cancel an offer. */
export class CancelHiringOfferCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<CancelHiringOfferRequest>) {
        super()
    }
}
