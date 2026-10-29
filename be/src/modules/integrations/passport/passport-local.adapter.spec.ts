import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { PassportAuthenticator } from "./passport.contracts"
import { PASSPORT_AUTHENTICATOR } from "./passport.decorators"
import { PassportLocalStrategy } from "./passport-local.adapter"

const SUBJECT = { userId: "u1", email: "an@example.test" }

const build = async () => {
    const authenticator = mock<PassportAuthenticator>()
    authenticator.verifyPassword.mockResolvedValue(SUBJECT)
    const moduleRef = await Test.createTestingModule({
        providers: [PassportLocalStrategy, { provide: PASSPORT_AUTHENTICATOR, useValue: authenticator }],
    }).compile()
    return { strategy: moduleRef.get(PassportLocalStrategy), authenticator }
}

describe("PassportLocalStrategy", () => {
    it("hands the posted pair to the authenticator and answers the person it established", async () => {
        const { strategy, authenticator } = await build()

        await expect(strategy.validate("an@example.test", "pw-123456")).resolves.toEqual(SUBJECT)

        expect(authenticator.verifyPassword).toHaveBeenCalledWith("an@example.test", "pw-123456")
    })

    it("lets the refusal of the authenticator through", async () => {
        const { strategy, authenticator } = await build()
        const refusal = new Error("wrong pair")
        authenticator.verifyPassword.mockRejectedValue(refusal)

        await expect(strategy.validate("an@example.test", "bad")).rejects.toBe(refusal)
    })
})
