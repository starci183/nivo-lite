import type { OrderTemplateListingRequest } from "../../application/order-template-listing.contracts"
import type { PayableOrder } from "@modules/domain/billing"
import type { OrderTemplateListingInput } from "./dto/order-template-listing.input"
import type { TemplateOrderType } from "./dto/template-order.type"
import { toTemplateOrderType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of orderTemplateListing to the request. */
export const toOrderTemplateListingRequest = (
    workspaceId: string,
    input: OrderTemplateListingInput,
): OrderTemplateListingRequest => ({ workspaceId, listingId: input.listingId })

/** Maps the answer to the GraphQL type. */
export const toOrderTemplateListingType = (result: PayableOrder): TemplateOrderType => toTemplateOrderType(result)
