import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Profile } from "passport-google-oauth20"
import { Secret } from "@modules/platform/config"
import { PassportError, PassportErrorCode } from "./errors/passport.error"
import type { GoogleStateClient } from "./google-state.client"
import type { PassportAuthenticator } from "./passport.contracts"
import { PASSPORT_AUTHENTICATOR, PASSPORT_GOOGLE_STATE, PASSPORT_OPTIONS } from "./passport.decorators"
import { PassportGoogleStrategy, googleProfileOf } from "./passport-google.adapter"

const SUBJECT = { userId: "u1", email: "an@example.test" }
const GOOGLE = {
    clientId: "client",
    clientSecret: new Secret("secret"),
    callbackUrl: "https://api.example.test/auth/google/callback",
}

const profile = (overrides: Partial<Profile> = {}, verified: boolean = true): Profile => ({
    provider: "google",
    profileUrl: "https://profiles.example.test/g-1",
    id: "g-1",
    displayName: "An Nguyen",
    emails: [{ value: "an@example.test", verified }],
    photos: [{ value: "https://img.example.test/an.png" }],
    _raw: "{}",
    _json: { iss: "https://accounts.google.com", aud: "client", sub: "g-1", iat: 1, exp: 2, email_verified: verified },
    ...overrides,
})

/** A profile whose email_verified claim arrives as text, which Google sends on some accounts. */
const textVerified = (claim: string): Profile => {
    const base = profile()
    return Object.assign(base, { _json: Object.assign({ ...base._json }, { email_verified: claim }) })
}

/** A profile with nothing released but the id: no name, no email, no picture. */
const bare = (): Profile => {
    const { emails: _emails, photos: _photos, ...rest } = profile()
    return { ...rest, displayName: "" }
}

const build = async (google: typeof GOOGLE | null = GOOGLE) => {
    const authenticator = mock<PassportAuthenticator>()
    authenticator.signInWithGoogle.mockResolvedValue(SUBJECT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PassportGoogleStrategy,
            { provide: PASSPORT_OPTIONS, useValue: { google } },
            { provide: PASSPORT_AUTHENTICATOR, useValue: authenticator },
            { provide: PASSPORT_GOOGLE_STATE, useValue: mock<GoogleStateClient>() },
        ],
    }).compile()
    return { strategy: moduleRef.get(PassportGoogleStrategy), authenticator }
}

describe("PassportGoogleStrategy", () => {
    it("hands the Google profile to the authenticator and answers the person it stands for", async () => {
        const { strategy, authenticator } = await build()

        await expect(strategy.validate("access", "refresh", profile())).resolves.toEqual(SUBJECT)

        expect(authenticator.signInWithGoogle).toHaveBeenCalledWith({
            subject: "g-1",
            email: "an@example.test",
            emailVerified: true,
            name: "An Nguyen",
            picture: "https://img.example.test/an.png",
        })
    })

    it("refuses to start without a Google client", async () => {
        await expect(build(null)).rejects.toMatchObject({ code: PassportErrorCode.GoogleUnavailable })
    })
})

describe("googleProfileOf", () => {
    it("reads the email verification Google reports, as a flag or as text", () => {
        expect(googleProfileOf(profile({}, true)).emailVerified).toBe(true)
        expect(googleProfileOf(textVerified("true")).emailVerified).toBe(true)
        expect(googleProfileOf(profile({}, false)).emailVerified).toBe(false)
        expect(googleProfileOf(textVerified("no")).emailVerified).toBe(false)
    })

    it("answers null for what Google did not release", () => {
        expect(googleProfileOf(bare())).toMatchObject({
            email: null,
            name: null,
            picture: null,
        })
    })

    it("refuses an account without a subject", () => {
        expect(() => googleProfileOf(profile({ id: "" }))).toThrow(PassportError)
    })
})
