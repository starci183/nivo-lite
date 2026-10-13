import { Command } from "@nestjs/cqrs"
import type { RespondOfferOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RespondHiringOfferRequest } from "./respond-hiring-offer.contracts"

/** Asks for accept or decline an offer from the candidate's link. */
export class RespondHiringOfferCommand extends Command<RespondOfferOutput> {
    constructor(readonly params: PublicExecuteParams<RespondHiringOfferRequest>) {
        super()
    }
}
