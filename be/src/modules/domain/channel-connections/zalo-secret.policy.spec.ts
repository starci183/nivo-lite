import { hasLiveTokens, parseZaloSecret } from "./zalo-secret.policy"

const NOW = Date.parse("2026-10-12T00:00:00.000Z")

describe("parseZaloSecret", () => {
    it("reads the app keys and keeps the tokens and a pending authorization", () => {
        const secret = parseZaloSecret(
            JSON.stringify({
                appId: "1",
                appSecret: "s",
                oaSecret: "o",
                accessToken: "at",
                refreshToken: "rt",
                refreshExpiresAt: "2027-01-01T00:00:00.000Z",
                pkce: { verifier: "v", nonce: "n", exp: 5 },
            }),
        )

        expect(secret).toEqual({
            appId: "1",
            appSecret: "s",
            oaSecret: "o",
            accessToken: "at",
            refreshToken: "rt",
            refreshExpiresAt: "2027-01-01T00:00:00.000Z",
            pkce: { verifier: "v", nonce: "n", exp: 5 },
        })
    })

    it("defaults a missing OA secret to blank and drops malformed optional parts", () => {
        expect(
            parseZaloSecret(JSON.stringify({ appId: "1", appSecret: "s", pkce: { verifier: "v" }, accessToken: 3 })),
        ).toEqual({
            appId: "1",
            appSecret: "s",
            oaSecret: "",
        })
        expect(parseZaloSecret(JSON.stringify({ appId: "1", appSecret: "s", pkce: "x" }))).toEqual({
            appId: "1",
            appSecret: "s",
            oaSecret: "",
        })
    })

    it("answers null for text that is not a Zalo credential", () => {
        expect(parseZaloSecret("not json")).toBeNull()
        expect(parseZaloSecret("null")).toBeNull()
        expect(parseZaloSecret("[1]")).toBeNull()
        expect(parseZaloSecret(JSON.stringify({ appId: 1, appSecret: "s" }))).toBeNull()
        expect(parseZaloSecret(JSON.stringify({ appId: "1" }))).toBeNull()
    })
})

describe("hasLiveTokens", () => {
    const base = { appId: "1", appSecret: "s", oaSecret: "" }

    it("needs a refresh token that has not expired", () => {
        expect(hasLiveTokens(base, NOW)).toBe(false)
        expect(hasLiveTokens({ ...base, refreshToken: "rt" }, NOW)).toBe(true)
        expect(hasLiveTokens({ ...base, refreshToken: "rt", refreshExpiresAt: "2027-01-01T00:00:00.000Z" }, NOW)).toBe(
            true,
        )
        expect(hasLiveTokens({ ...base, refreshToken: "rt", refreshExpiresAt: "2026-01-01T00:00:00.000Z" }, NOW)).toBe(
            false,
        )
        expect(hasLiveTokens({ ...base, refreshToken: "rt", refreshExpiresAt: "garbage" }, NOW)).toBe(true)
    })
})
