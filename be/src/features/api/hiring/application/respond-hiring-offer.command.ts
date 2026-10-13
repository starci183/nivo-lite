import { Command } from "@nestjs/cqrs"
import type { RespondOfferOutput, RespondOfferParams } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** Asks for accept or decline an offer from the candidate's link. */
export class RespondHiringOfferCommand extends Command<RespondOfferOutput> {
    constructor(readonly params: PublicExecuteParams<RespondOfferParams>) {
        super()
    }
}
