import type { GetLoyaltyPageRequest, GetLoyaltyPageResult } from "../../application/get-loyalty-page.contracts"
import type { GetLoyaltyPageParamsRequest } from "./dto/get-loyalty-page.request"
import type { GetLoyaltyPageResponse } from "./dto/get-loyalty-page.response"

/** Maps the HTTP input of get-loyalty-page to the command request. */
export const toGetLoyaltyPageRequest = (params: GetLoyaltyPageParamsRequest): GetLoyaltyPageRequest => ({
    slug: params.slug,
})

/** Maps the get-loyalty-page result to the HTTP answer. */
export const toGetLoyaltyPageResponse = (result: GetLoyaltyPageResult): GetLoyaltyPageResponse => result
