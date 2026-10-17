import type { HiringLinkRequest } from "./hiring-link.contracts"
import { Command } from "@nestjs/cqrs"
import type { RespondOfferOutput, HiringOffersService } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

type RespondOfferParams = Parameters<HiringOffersService["respond"]>[0]

/** Asks for accept or decline an offer from the candidate's link. */
export class RespondHiringOfferCommand extends Command<RespondOfferOutput> {
    constructor(readonly params: PublicExecuteParams<HiringLinkRequest<RespondOfferParams>>) {
        super()
    }
}
