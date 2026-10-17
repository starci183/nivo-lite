import { Test } from "@nestjs/testing"
import { createHash } from "node:crypto"
import { challengeOf, newZaloVerifier, zaloAuthorizeUrl, zaloCallbackUrl } from "./zalo-oauth.policy"
const POLICY = Symbol("./zalo-oauth.policy")
type PolicySubject = {
    newZaloVerifier: typeof newZaloVerifier
    challengeOf: typeof challengeOf
    zaloCallbackUrl: typeof zaloCallbackUrl
    zaloAuthorizeUrl: typeof zaloAuthorizeUrl
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { newZaloVerifier, challengeOf, zaloCallbackUrl, zaloAuthorizeUrl } }],
    }).compile()
    return moduleRef.get<PolicySubject>(POLICY)
}

describe("PKCE", () => {
    it("makes a fresh verifier each time and its S256 challenge", async () => {
        const subject = await build()
        const verifier = subject.newZaloVerifier()

        expect(verifier).not.toBe(subject.newZaloVerifier())
        expect(verifier.length).toBeGreaterThanOrEqual(43)
        expect(subject.challengeOf(verifier)).toBe(createHash("sha256").update(verifier).digest("base64url"))
    })
})

describe("zaloCallbackUrl", () => {
    it("points the callback at the connections page of the site and needs a site url", async () => {
        const subject = await build()
        expect(subject.zaloCallbackUrl({ siteUrl: "https://nivo.vn/" })).toBe(
            "https://nivo.vn/connections/zalo/callback",
        )
        expect(subject.zaloCallbackUrl({ siteUrl: undefined })).toBeNull()
    })
})

describe("zaloAuthorizeUrl", () => {
    it("builds the permission url with the challenge and the state", async () => {
        const subject = await build()
        const url = new URL(
            subject.zaloAuthorizeUrl(
                { zaloOauthBase: undefined },
                "app-1",
                "https://nivo.vn/cb",
                "verifier-1",
                "conn.nonce",
            ),
        )

        expect(url.origin + url.pathname).toBe("https://oauth.zaloapp.com/v4/oa/permission")
        expect(url.searchParams.get("app_id")).toBe("app-1")
        expect(url.searchParams.get("redirect_uri")).toBe("https://nivo.vn/cb")
        expect(url.searchParams.get("code_challenge")).toBe(subject.challengeOf("verifier-1"))
        expect(url.searchParams.get("state")).toBe("conn.nonce")
    })

    it("follows a local fake host", async () => {
        const subject = await build()
        expect(subject.zaloAuthorizeUrl({ zaloOauthBase: "http://fake.test/" }, "a", "r", "v", "s")).toMatch(
            /^http:\/\/fake\.test\/v4\/oa\/permission\?/u,
        )
    })
})
