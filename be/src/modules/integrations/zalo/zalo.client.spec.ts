import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { ZaloErrorCode } from "./errors/zalo.error"
import { ZaloClient } from "./zalo.client"
import { ZALO_OPTIONS } from "./zalo.decorators"
import type { ZaloOptions } from "./zalo.options"
import { challengeOf } from "./zalo-oauth.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const options: ZaloOptions = { oauthBase: "https://oauth.test", apiBase: "https://api.test", timeoutMs: 5000 }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloClient, { provide: HTTP_CLIENT, useValue: http }, { provide: ZALO_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(ZaloClient), http }
}

describe("ZaloClient / authorizeUrl", () => {
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

describe("ZaloClient / exchangeCode and refreshTokens", () => {
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
            objectLike({
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

describe("ZaloClient / sendCsText", () => {
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

describe("ZaloClient / userDisplayName", () => {
    it("asks for the user detail and answers the trimmed display name", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { data: { display_name: " Minh " } } })

        await expect(client.userDisplayName("access", "user-1")).resolves.toBe("Minh")

        expect(http.request).toHaveBeenCalledWith(
            objectLike({
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

        await expect(client.userDisplayName("access", "user-1")).rejects.toMatchObject({
            code: ZaloErrorCode.Unavailable,
        })
    })
})

describe("ZaloClient / createArticle", () => {
    const article = {
        title: "A weekend",
        author: "HAKUEN",
        coverUrl: "https://x/cover.png",
        description: "Offer",
        paragraphs: ["Paragraph 1", "Paragraph 2"],
        publish: false,
    }

    it("creates a hidden article with the cover and paragraphs and answers its token", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 200, body: { error: 0, data: { token: "tok-1" } } })

        await expect(client.createArticle("access", article)).resolves.toBe("tok-1")
        expect(http.request).toHaveBeenCalledWith(
            objectLike({
                method: "POST",
                url: "https://api.test/v2.0/article/create",
                headers: { access_token: "access" },
                body: objectLike({
                    type: "normal",
                    status: "hide",
                    cover: { cover_type: "photo", photo_url: "https://x/cover.png", status: "show" },
                    body: [
                        { type: "text", content: "Paragraph 1" },
                        { type: "text", content: "Paragraph 2" },
                    ],
                }),
            }),
        )
    })

    it("shows the article when asked to publish", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 200, body: { error: 0, data: { token: "tok-2" } } })

        await client.createArticle("access", { ...article, publish: true })

        expect(http.request).toHaveBeenCalledWith(objectLike({ body: objectLike({ status: "show" }) }))
    })

    it("is a rejection when Zalo answers without a token", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 200, body: { error: 0, data: {} } })

        await expect(client.createArticle("access", article)).rejects.toMatchObject({
            code: ZaloErrorCode.Rejected,
        })
    })
})

describe("ZaloClient / publishArticle", () => {
    const article = {
        title: "A weekend",
        author: "HAKUEN",
        coverUrl: "https://x/cover.png",
        description: "Offer",
        paragraphs: ["Paragraph 1"],
        publish: false,
    }

    it("verifies the creation token into the article id and shows the article with the same content", async () => {
        const { client, http } = await build()
        http.request
            .mockResolvedValueOnce({ status: 200, body: { error: 0, data: { id: "art-1" } } })
            .mockResolvedValueOnce({ status: 200, body: { error: 0, data: { token: "tok-9" } } })

        await expect(client.publishArticle("access", "tok-1", article)).resolves.toBe("art-1")
        expect(http.request.mock.calls[0]?.[0]).toEqual(
            objectLike({ url: "https://api.test/v2.0/article/verify", body: { token: "tok-1" } }),
        )
        expect(http.request.mock.calls[1]?.[0]).toEqual(
            objectLike({
                method: "POST",
                url: "https://api.test/v2.0/article/update",
                body: objectLike({ id: "art-1", status: "show", title: "A weekend", type: "normal" }),
            }),
        )
    })

    it("is a rejection when the token verifies to no article", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 200, body: { error: 0, data: {} } })

        await expect(client.publishArticle("access", "tok-1", article)).rejects.toMatchObject({
            code: ZaloErrorCode.Rejected,
        })
        expect(http.request).toHaveBeenCalledTimes(1)
    })
})

describe("ZaloClient / articles", () => {
    it("reads the newest articles with their views and shares, leaving out unreadable rows", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({
            status: 200,
            body: {
                error: 0,
                data: {
                    medias: [
                        {
                            id: "art-1",
                            title: "A weekend",
                            status: "show",
                            create_date: Date.parse("2026-10-17T02:00:00.000Z"),
                            total_view: 120,
                            total_share: 4,
                        },
                        { id: "art-2", create_date: Date.parse("2026-10-16T02:00:00.000Z") },
                        { id: "art-3", create_date: Number.NaN },
                        { id: "art-4" },
                        { id: "" },
                        "noise",
                    ],
                },
            },
        })

        await expect(client.articles("access")).resolves.toEqual([
            {
                id: "art-1",
                title: "A weekend",
                status: "show",
                createdAt: "2026-10-17T02:00:00.000Z",
                views: 120,
                shares: 4,
            },
            { id: "art-2", title: "", status: "", createdAt: "2026-10-16T02:00:00.000Z", views: 0, shares: 0 },
        ])
        expect(http.request).toHaveBeenCalledWith(
            objectLike({
                method: "GET",
                url: "https://api.test/v2.0/article/getslice?offset=0&limit=50&type=normal",
            }),
        )
    })

    it("answers no articles when Zalo lists none", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 200, body: { error: 0, data: {} } })

        await expect(client.articles("access")).resolves.toEqual([])
    })
})
