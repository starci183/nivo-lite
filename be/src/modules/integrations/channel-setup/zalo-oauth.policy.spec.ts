import { createHash } from "node:crypto"
import { challengeOf, newVerifier, zaloAuthorizeUrl, zaloCallbackUrl } from "./zalo-oauth.policy"

describe("PKCE", () => {
    it("makes a fresh verifier each time and its S256 challenge", () => {
        const verifier = newVerifier()

        expect(verifier).not.toBe(newVerifier())
        expect(verifier.length).toBeGreaterThanOrEqual(43)
        expect(challengeOf(verifier)).toBe(createHash("sha256").update(verifier).digest("base64url"))
    })
})

describe("zaloCallbackUrl", () => {
    it("points the callback at the connections page of the site and needs a site url", () => {
        expect(zaloCallbackUrl({ siteUrl: "https://nivo.vn/" })).toBe("https://nivo.vn/connections/zalo/callback")
        expect(zaloCallbackUrl({ siteUrl: undefined })).toBeNull()
    })
})

describe("zaloAuthorizeUrl", () => {
    it("builds the permission url with the challenge and the state", () => {
        const url = new URL(
            zaloAuthorizeUrl({ zaloOauthBase: undefined }, "app-1", "https://nivo.vn/cb", "verifier-1", "conn.nonce"),
        )

        expect(url.origin + url.pathname).toBe("https://oauth.zaloapp.com/v4/oa/permission")
        expect(url.searchParams.get("app_id")).toBe("app-1")
        expect(url.searchParams.get("redirect_uri")).toBe("https://nivo.vn/cb")
        expect(url.searchParams.get("code_challenge")).toBe(challengeOf("verifier-1"))
        expect(url.searchParams.get("state")).toBe("conn.nonce")
    })

    it("follows a local fake host", () => {
        expect(zaloAuthorizeUrl({ zaloOauthBase: "http://fake.test/" }, "a", "r", "v", "s")).toMatch(
            /^http:\/\/fake\.test\/v4\/oa\/permission\?/u,
        )
    })
})
