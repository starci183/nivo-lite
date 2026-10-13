import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import type { PublicCheckCode, PublicPoints, RequestCodeAnswer, VerifyCodeAnswer } from "./loyalty.contracts"

const REFUSALS = {
    bad_phone: LoyaltyErrorCode.PhoneInvalid,
    closed: LoyaltyErrorCode.PageNotFound,
    busy: LoyaltyErrorCode.CodeBusy,
    wrong: LoyaltyErrorCode.CodeWrong,
} as const

/** The accepted, non-enumerating acknowledgement of a public code request. */
interface PublicLoyaltyCodeAnswer {
    /** The visitor-facing outcome code. */
    readonly code: PublicCheckCode
}

/** A points view that a verified public code has unlocked. */
interface PublicLoyaltyVerifiedAnswer extends Pick<VerifyCodeAnswer, "code"> {
    /** The unlocked points and rewards. */
    readonly points: PublicPoints
}

/** Keeps the accepted answer non-enumerating and promotes refusals to domain errors. */
export const toRequestLoyaltyCodeType = (result: RequestCodeAnswer): PublicLoyaltyCodeAnswer => {
    if (result.code !== "none") throw new LoyaltyError({ code: REFUSALS[result.code] })
    return { code: result.code }
}

/** Answers unlocked points or promotes a failed verification to a localized domain error. */
export const toVerifyLoyaltyCodeType = (result: VerifyCodeAnswer): PublicLoyaltyVerifiedAnswer => {
    if (result.code !== "none") throw new LoyaltyError({ code: REFUSALS[result.code] })
    if (result.points === null) throw new LoyaltyError({ code: LoyaltyErrorCode.CodeWrong })
    return { code: result.code, points: result.points }
}
