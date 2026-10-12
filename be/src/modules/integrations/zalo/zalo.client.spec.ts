import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { ZaloErrorCode } from "./errors/zalo.error"
import { ZaloClient } from "./zalo.client"
import { ZALO_OPTIONS } from "./zalo.decorators"
import type { ZaloOptions } from "./zalo.options"
import { challengeOf } from "./zalo-oauth.policy"

const options: ZaloOptions = { oauthBase: "https://oauth.test", apiBase: "https://api.test", timeoutMs: 5000 }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: ZALO_OPTIONS, useValue: options },
        ],
    }).compile()
    return { client: moduleRef.get(ZaloClient), http }
}

describe("ZaloClient", () => {
    describe("authorizeUrl", () => {
        it("builds the permission URL with the S256 challenge of the verifier", async () => {
            const { client } = await build()

            const url = new URL(client.authorizeUrl("app-1", "https://site.test/cb", "verifier", "state-1"))

            expect(url.origin + url.pathname).toBe("https://oauth.test/v4/oa/permission")
            expect(Object.fromEntries(url.searchParams)).toEqual({
                app_id: "app-1",
                redirect_uri: "https://site.test/cb",
                code_challenge: challengeOf("verifier"),
                state: "state-1",
            })
        })
    })

    describe("exchangeCode and refreshTokens", () => {
        it("posts the authorization-code grant with the app secret header and answers the tokens", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { access_token: "access", refresh_token: "refresh", expires_in: "7200" },
            })

            await expect(client.exchangeCode("app-1", "secret", "code-1", "verifier")).resolves.toEqual({
                accessToken: "access",
                refreshToken: "refresh",
                expiresInSeconds: 7200,
            })

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://oauth.test/v4/oa/access_token",
                headers: { secret_key: "secret" },
                form: { code: "code-1", app_id: "app-1", grant_type: "authorization_code", code_verifier: "verifier" },
                timeoutMs: 5000,
            })
        })

        it("posts the refresh grant and falls back to one hour when the answer gives no lifetime", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 200, body: { access_token: "a2", refresh_token: "r2" } })

            await expect(client.refreshTokens("app-1", "secret", "r1")).resolves.toEqual({
                accessToken: "a2",
                refreshToken: "r2",
                expiresInSeconds: 3600,
            })

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    form: { refresh_token: "r1", app_id: "app-1", grant_type: "refresh_token" },
                }),
            )
        })

        it("reports the numeric error and the reason Zalo gave when it refuses the grant", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { error: -118, error_description: "refresh token is used" },
            })

            await expect(client.refreshTokens("app-1", "secret", "r1")).rejects.toMatchObject({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v4/oa/access_token", reason: "refresh token is used", zaloCode: -118 },
            })
        })

        it("reports the status when the answer is empty and carries no numeric error", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 502, body: undefined })

            await expect(client.refreshTokens("app-1", "secret", "r1")).rejects.toMatchObject({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v4/oa/access_token", reason: "502" },
            })
        })

        it("maps a transport failure to unavailable and keeps the cause", async () => {
            const { client, http } = await build()
            const failure = new Error("timed out")
            http.request.mockRejectedValue(failure)

            await expect(client.refreshTokens("app-1", "secret", "r1")).rejects.toMatchObject({
                code: ZaloErrorCode.Unavailable,
                cause: failure,
            })
        })
    })

    describe("sendCsText", () => {
        it("sends the text to the user with the access token header", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 200, body: { error: 0, data: { message_id: "m-1" } } })

            await expect(client.sendCsText("access", "user-1", "Hello")).resolves.toBeUndefined()

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://api.test/v3.0/oa/message/cs",
                headers: { access_token: "access" },
                body: { recipient: { user_id: "user-1" }, message: { text: "Hello" } },
                timeoutMs: 5000,
            })
        })

        it("carries the numeric error of a refusal Zalo answered with HTTP 200", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 200, body: { error: -230, message: "window closed" } })

            await expect(client.sendCsText("access", "user-1", "Hello")).rejects.toMatchObject({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v3.0/oa/message/cs", reason: "window closed", zaloCode: -230 },
            })
        })

        it("rejects an answer that is not a JSON object", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 500, body: undefined })

            await expect(client.sendCsText("access", "user-1", "Hello")).rejects.toMatchObject({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v3.0/oa/message/cs", reason: "HTTP 500" },
            })
        })

        it("maps a transport failure to unavailable", async () => {
            const { client, http } = await build()
            http.request.mockRejectedValue(new Error("down"))

            await expect(client.sendCsText("access", "user-1", "Hello")).rejects.toMatchObject({
                code: ZaloErrorCode.Unavailable,
            })
        })
    })

    describe("userDisplayName", () => {
        it("asks for the user detail and answers the trimmed display name", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 200, body: { data: { display_name: " Minh " } } })

            await expect(client.userDisplayName("access", "user-1")).resolves.toBe("Minh")

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: "GET",
                    url: `https://api.test/v3.0/oa/user/detail?data=${encodeURIComponent('{"user_id":"user-1"}')}`,
                }),
            )
        })

        it("falls back to the alias and then to an empty text when Zalo gives no usable name", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce({ status: 200, body: { data: { user_alias: "Lan" } } })
            http.request.mockResolvedValueOnce({ status: 200, body: { data: { display_name: "  " } } })
            http.request.mockResolvedValueOnce({ status: 200, body: { data: {} } })
            http.request.mockResolvedValueOnce({ status: 200, body: {} })

            await expect(client.userDisplayName("access", "user-1")).resolves.toBe("Lan")
            await expect(client.userDisplayName("access", "user-1")).resolves.toBe("")
            await expect(client.userDisplayName("access", "user-1")).resolves.toBe("")
            await expect(client.userDisplayName("access", "user-1")).resolves.toBe("")
        })

        it("fails like any other call when the lookup fails", async () => {
            const { client, http } = await build()
            http.request.mockRejectedValue(new Error("down"))

            await expect(client.userDisplayName("access", "user-1")).rejects.toMatchObject({ code: ZaloErrorCode.Unavailable })
        })
    })
})
