import type { TemplateUpdateOffersRequest } from "../../application/template-update-offers.contracts"
import type { UpdateOffer } from "@modules/domain/agent-templates"
import type { UpdateOfferType } from "./dto/update-offer.type"
import { toUpdateOfferType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of templateUpdateOffers to the request. */
export const toTemplateUpdateOffersRequest = (workspaceId: string): TemplateUpdateOffersRequest => ({ workspaceId })

/** Maps the answer to the GraphQL type. */
export const toTemplateUpdateOffersType = (result: ReadonlyArray<UpdateOffer>): Array<UpdateOfferType> =>
    result.map((item) => toUpdateOfferType(item))
