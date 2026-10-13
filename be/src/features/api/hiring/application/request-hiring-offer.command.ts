import { Command } from "@nestjs/cqrs"
import type { RequestOfferOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestHiringOfferRequest } from "./request-hiring-offer.contracts"

/** Asks for draft an offer for a candidate and ask for approval. */
export class RequestHiringOfferCommand extends Command<RequestOfferOutput> {
    constructor(readonly params: ExecuteParams<RequestHiringOfferRequest>) {
        super()
    }
}
