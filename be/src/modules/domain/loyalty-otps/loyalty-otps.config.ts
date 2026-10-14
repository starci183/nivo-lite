import type { EnvSource } from "@modules/platform/config"
import type { LoyaltyOtpsOptions } from "./loyalty-otps.options"
import { assertOtpPepper } from "./policies/otp-pepper.policy"

/** Reads the required, independent pepper for loyalty code hashes and refuses values shorter than 32 characters. */
export const parseLoyaltyOtpsConfig = (env: EnvSource): LoyaltyOtpsOptions => {
    const pepper = env.secret("OTP_PEPPER")
    assertOtpPepper(pepper.reveal())
    return { pepper }
}
