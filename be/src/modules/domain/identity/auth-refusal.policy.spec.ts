import { Test } from "@nestjs/testing"
import { AUTH_ERROR_CODES, AuthError, PassportError } from "@modules/integrations/passport"
import { refusalOf, refusing } from "./auth-refusal.policy"
import { IdentityError } from "./errors/identity.error"

const SUBJECT = Symbol("auth-refusal.policy")
type Subject = { refusalOf: typeof refusalOf; refusing: typeof refusing }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { refusalOf, refusing } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("refusalOf", () => {
    it("turns a refusal of an identity code into the identity error with the same code", async () => {
        const subject = await build()
        const cause = new AuthError(AUTH_ERROR_CODES.RefreshReused)

        const refusal = subject.refusalOf(cause)

        expect(refusal).toBeInstanceOf(IdentityError)
        expect(refusal).toMatchObject({ code: "IDENTITY_REFRESH_REUSED", cause })
    })

    it("turns a refusal of a passport code into the passport error with the same code", async () => {
        const subject = await build()
        const cause = new AuthError(AUTH_ERROR_CODES.GoogleUnavailable)

        const refusal = subject.refusalOf(cause)

        expect(refusal).toBeInstanceOf(PassportError)
        expect(refusal).toMatchObject({ code: "PASSPORT_GOOGLE_UNAVAILABLE", cause })
    })

    it("answers nothing for a refusal of a code this app does not know", async () => {
        const subject = await build()
        const cause = Object.assign(new AuthError(AUTH_ERROR_CODES.Unauthenticated), {
            code: "NEW_CODE_OF_THE_PACKAGE",
        })

        expect(subject.refusalOf(cause)).toBeUndefined()
    })
})

describe("refusing", () => {
    it("answers the value of the work", async () => {
        const subject = await build()

        await expect(subject.refusing(() => Promise.resolve(7))).resolves.toBe(7)
    })

    it("throws the refusals of the package as this app's errors", async () => {
        const subject = await build()

        await expect(
            subject.refusing(() => Promise.reject(new AuthError(AUTH_ERROR_CODES.TooManyAttempts))),
        ).rejects.toMatchObject({ code: "IDENTITY_TOO_MANY_ATTEMPTS" })
    })

    it("leaves a refusal of a code this app does not know as the package threw it", async () => {
        const subject = await build()
        const cause = Object.assign(new AuthError(AUTH_ERROR_CODES.Unauthenticated), {
            code: "NEW_CODE_OF_THE_PACKAGE",
        })

        await expect(subject.refusing(() => Promise.reject(cause))).rejects.toBe(cause)
    })

    it("leaves a refusal of a code this app does not know as the package threw it", async () => {
        const subject = await build()
        const cause = Object.assign(new AuthError(AUTH_ERROR_CODES.Unauthenticated), {
            code: "NEW_CODE_OF_THE_PACKAGE",
        })

        await expect(subject.refusing(() => Promise.reject(cause))).rejects.toBe(cause)
    })

    it("leaves any other failure as it is", async () => {
        const subject = await build()
        const failure = new Error("database is down")

        await expect(subject.refusing(() => Promise.reject(failure))).rejects.toBe(failure)
    })
})
