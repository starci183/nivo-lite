import type { HiringLinkRequest } from "./hiring-link.contracts"
import { Query } from "@nestjs/cqrs"
import type { PublicOfferOutput, HiringOffersService } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

type PublicOfferParams = Parameters<HiringOffersService["publicView"]>[0]

/** Asks for read an offer from the candidate's link. */
export class PublicHiringOfferQuery extends Query<PublicOfferOutput> {
    constructor(readonly params: PublicExecuteParams<HiringLinkRequest<PublicOfferParams>>) {
        super()
    }
}
