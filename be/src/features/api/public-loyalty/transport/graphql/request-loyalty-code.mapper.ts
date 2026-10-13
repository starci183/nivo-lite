import type { RequestLoyaltyCodeRequest } from "../../application/request-loyalty-code.contracts"
import type { RequestLoyaltyCodeInput } from "./dto/request-loyalty-code.input"

/** Maps the GraphQL phone to the existing anonymous code request. */
export const toRequestLoyaltyCodeRequest = (input: RequestLoyaltyCodeInput): RequestLoyaltyCodeRequest => ({
    slug: input.slug,
    phone: input.phone,
})

/** Keeps the accepted answer non-enumerating and throws an explicit refusal. */
export { toRequestLoyaltyCodeType } from "@modules/domain/loyalty"
