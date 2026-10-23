import type * as SubjectModule from "./otp-pepper.policy"
import { Test } from "@nestjs/testing"
import { LoyaltyOtpsError, LoyaltyOtpsErrorCode } from "../errors/loyalty-otps.error"
import { assertOtpPepper } from "./otp-pepper.policy"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("otp-pepper.policy")
type Subject = Pick<typeof SubjectModule, "assertOtpPepper">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { assertOtpPepper } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("assertOtpPepper", () => {
    it.each([0, 31])("refuses a pepper with %i characters and names its key", async (length) => {
        const subject = await buildSubject()

        const validate = () => subject.assertOtpPepper("p".repeat(length))

        expect(validate).toThrow(LoyaltyOtpsError)
        expect(thrownBy(validate)).toEqual(
            objectLike({ code: LoyaltyOtpsErrorCode.PepperTooShort, params: { key: "OTP_PEPPER" } }),
        )
    })

    it.each([32, 33])("accepts a pepper with %i characters", async (length) => {
        const subject = await buildSubject()

        expect(() => subject.assertOtpPepper("p".repeat(length))).not.toThrow()
    })
})
