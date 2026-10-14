import { LoyaltyOtpsError, LoyaltyOtpsErrorCode } from "../errors/loyalty-otps.error"
import { assertOtpPepper } from "./otp-pepper.policy"

describe("assertOtpPepper", () => {
    it.each([0, 31])("refuses a pepper with %i characters and names its key", (length) => {
        const validate = () => assertOtpPepper("p".repeat(length))

        expect(validate).toThrow(LoyaltyOtpsError)
        expect(validate).toThrow(
            expect.objectContaining({ code: LoyaltyOtpsErrorCode.PepperTooShort, params: { key: "OTP_PEPPER" } }),
        )
    })

    it.each([32, 33])("accepts a pepper with %i characters", (length) => {
        expect(() => assertOtpPepper("p".repeat(length))).not.toThrow()
    })
})
