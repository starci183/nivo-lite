import { Query } from "@nestjs/cqrs"
import type { PublicOfferOutput, PublicOfferParams } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** Asks for read an offer from the candidate's link. */
export class PublicHiringOfferQuery extends Query<PublicOfferOutput> {
    constructor(readonly params: PublicExecuteParams<PublicOfferParams>) {
        super()
    }
}
