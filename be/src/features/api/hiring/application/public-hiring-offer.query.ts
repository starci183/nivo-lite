import { Query } from "@nestjs/cqrs"
import type { PublicOfferOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { PublicHiringOfferRequest } from "./public-hiring-offer.contracts"

/** Asks for read an offer from the candidate's link. */
export class PublicHiringOfferQuery extends Query<PublicOfferOutput> {
    constructor(readonly params: PublicExecuteParams<PublicHiringOfferRequest>) {
        super()
    }
}
