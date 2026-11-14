import { Query } from "@nestjs/cqrs"
import type { ProviderOffer } from "@modules/domain/provider-offer"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetProviderOfferRequest } from "./get-provider-offer.contracts"

/** Asks what the provider of a connected account offers at its three levels. */
export class GetProviderOfferQuery extends Query<ProviderOffer> {
    constructor(readonly params: ExecuteParams<GetProviderOfferRequest>) {
        super()
    }
}
