import { Test } from "@nestjs/testing"
import { DRIVE_READ_SCOPE, GOOGLE_SCOPE } from "@modules/integrations/google"
import { freshAccessToken, grantsDriveRead, parseTokens } from "./google-tokens.policy"

const SUBJECT = Symbol("google-tokens.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseTokens, freshAccessToken, grantsDriveRead } }],
    }).compile()
    return moduleRef.get<typeof import("./google-tokens.policy")>(SUBJECT)
}

describe("google-tokens.policy", () => {
    it("reads the stored token fields and ignores anything else", async () => {
        const subject = await buildSubject()

        expect(subject.parseTokens('{"access_token":"a","refresh_token":"r","expires_at":5,"x":1}')).toEqual({
            access_token: "a",
            refresh_token: "r",
            expires_at: 5,
        })
        expect(subject.parseTokens('{"access_token":3}')).toEqual({})
        expect(subject.parseTokens("not json")).toEqual({})
        expect(subject.parseTokens("[]")).toEqual({})
    })

    it("keeps an access token only while it is good past the margin", async () => {
        const subject = await buildSubject()

        expect(subject.freshAccessToken({ access_token: "a", expires_at: 200_000 }, 100_000)).toBe("a")
        expect(subject.freshAccessToken({ access_token: "a", expires_at: 150_000 }, 100_000)).toBeNull()
        expect(subject.freshAccessToken({ expires_at: 900_000 }, 0)).toBeNull()
    })

    it("tells whether the Drive read scope was granted", async () => {
        const subject = await buildSubject()

        expect(subject.grantsDriveRead(DRIVE_READ_SCOPE)).toBe(true)
        expect(subject.grantsDriveRead(null)).toBe(true)
        expect(subject.grantsDriveRead(GOOGLE_SCOPE)).toBe(false)
    })
})
