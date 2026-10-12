import type { VerifyLoyaltyCodeRequest, VerifyLoyaltyCodeResult } from "../../application/verify-loyalty-code.contracts"
import type { VerifyLoyaltyCodeParamsRequest, VerifyLoyaltyCodeBodyRequest } from "./dto/verify-loyalty-code.request"
import type { VerifyLoyaltyCodeResponse } from "./dto/verify-loyalty-code.response"

/** Maps the HTTP input of verify-loyalty-code to the command request. */
export const toVerifyLoyaltyCodeRequest = (
    params: VerifyLoyaltyCodeParamsRequest,
    body: VerifyLoyaltyCodeBodyRequest,
): VerifyLoyaltyCodeRequest => ({ slug: params.slug, phone: body.phone, typed: body.typed })

/** Maps the verify-loyalty-code result to the HTTP answer. */
export const toVerifyLoyaltyCodeResponse = (result: VerifyLoyaltyCodeResult): VerifyLoyaltyCodeResponse => result
