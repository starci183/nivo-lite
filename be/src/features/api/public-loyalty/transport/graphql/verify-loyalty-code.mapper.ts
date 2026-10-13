import type { VerifyLoyaltyCodeRequest } from "../../application/verify-loyalty-code.contracts"
import type { VerifyLoyaltyCodeInput } from "./dto/verify-loyalty-code.input"

/** Maps the GraphQL code to the existing verification command. */
export const toVerifyLoyaltyCodeRequest = (input: VerifyLoyaltyCodeInput): VerifyLoyaltyCodeRequest => ({
    slug: input.slug,
    phone: input.phone,
    typed: input.code,
})

/** Maps unlocked points and rewards or throws the verification refusal. */
export { toVerifyLoyaltyCodeType } from "@modules/domain/loyalty"
