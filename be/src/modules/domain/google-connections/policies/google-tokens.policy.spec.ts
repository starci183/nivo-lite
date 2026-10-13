import { DRIVE_READ_SCOPE, GOOGLE_SCOPE } from "@modules/integrations/google"
import { freshAccessToken, grantsDriveRead, parseTokens } from "./google-tokens.policy"

describe("google-tokens.policy", () => {
    it("reads the stored token fields and ignores anything else", () => {
        expect(parseTokens('{"access_token":"a","refresh_token":"r","expires_at":5,"x":1}')).toEqual({
            access_token: "a",
            refresh_token: "r",
            expires_at: 5,
        })
        expect(parseTokens('{"access_token":3}')).toEqual({})
        expect(parseTokens("not json")).toEqual({})
        expect(parseTokens("[]")).toEqual({})
    })

    it("keeps an access token only while it is good past the margin", () => {
        expect(freshAccessToken({ access_token: "a", expires_at: 200_000 }, 100_000)).toBe("a")
        expect(freshAccessToken({ access_token: "a", expires_at: 150_000 }, 100_000)).toBeNull()
        expect(freshAccessToken({ expires_at: 900_000 }, 0)).toBeNull()
    })

    it("tells whether the Drive read scope was granted", () => {
        expect(grantsDriveRead(DRIVE_READ_SCOPE)).toBe(true)
        expect(grantsDriveRead(null)).toBe(true)
        expect(grantsDriveRead(GOOGLE_SCOPE)).toBe(false)
    })
})
