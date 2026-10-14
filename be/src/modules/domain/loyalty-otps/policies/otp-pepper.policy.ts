import { LoyaltyOtpsError, LoyaltyOtpsErrorCode } from "../errors/loyalty-otps.error"

/** Refuses a loyalty code pepper shorter than 32 characters, naming only its environment key in the boot error. */
export const assertOtpPepper = (pepper: string): void => {
    if (pepper.length < 32)
        throw new LoyaltyOtpsError({ code: LoyaltyOtpsErrorCode.PepperTooShort, params: { key: "OTP_PEPPER" } })
}
