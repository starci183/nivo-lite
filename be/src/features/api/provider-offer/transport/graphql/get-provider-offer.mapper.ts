import type { ProviderOffer } from "@modules/domain/provider-offer"
import type { GetProviderOfferRequest } from "../../application/get-provider-offer.contracts"
import type { GetProviderOfferInput } from "./dto/get-provider-offer.input"
import type { ProviderOfferType } from "./dto/get-provider-offer.type"

/** Maps the GraphQL arguments of providerOffer to the request. */
export const toGetProviderOfferRequest = (workspaceId: string, input: GetProviderOfferInput): GetProviderOfferRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of providerOffer to the GraphQL type: the capability already answers in its shape. */
export const toProviderOfferType = (offer: ProviderOffer): ProviderOfferType => offer
