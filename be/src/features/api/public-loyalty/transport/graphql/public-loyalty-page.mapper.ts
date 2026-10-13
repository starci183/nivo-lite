import type { GetLoyaltyPageRequest, GetLoyaltyPageResult } from "../../application/get-loyalty-page.contracts"
import type { PublicLoyaltyPageInput } from "./dto/public-loyalty-page.input"
import type { PublicLoyaltyPageType } from "./dto/public-loyalty-page.type"

/** Maps the GraphQL slug to the existing public program query. */
export const toPublicLoyaltyPageRequest = (input: PublicLoyaltyPageInput): GetLoyaltyPageRequest => ({
    slug: input.slug,
})

/** Maps the shop and program names to the GraphQL view. */
export const toPublicLoyaltyPageType = (result: GetLoyaltyPageResult): PublicLoyaltyPageType => ({
    slug: result.slug,
    shop: result.shop,
    name: result.name,
})
