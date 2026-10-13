import type {
    RequestLoyaltyCodeRequest,
    RequestLoyaltyCodeResult,
} from "../../application/request-loyalty-code.contracts"
import type { RequestLoyaltyCodeParamsRequest, RequestLoyaltyCodeBodyRequest } from "./dto/request-loyalty-code.request"
import type { RequestLoyaltyCodeResponse } from "./dto/request-loyalty-code.response"

/** Maps the HTTP input of request-loyalty-code to the command request. */
export const toRequestLoyaltyCodeRequest = (
    params: RequestLoyaltyCodeParamsRequest,
    body: RequestLoyaltyCodeBodyRequest,
): RequestLoyaltyCodeRequest => ({ slug: params.slug, phone: body.phone })

/** Maps the request-loyalty-code result to the HTTP answer. */
export const toRequestLoyaltyCodeResponse = (result: RequestLoyaltyCodeResult): RequestLoyaltyCodeResponse => result
