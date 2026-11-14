import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { ZaloErrorCode } from "./errors/zalo.error"
import { ZaloClient } from "./zalo.client"
import { ZALO_OPTIONS } from "./zalo.decorators"
import type { ZaloOptions } from "./zalo.options"

const options: ZaloOptions = {
    oauthBase: "https://oauth.test",
    apiBase: "https://api.test",
    businessBase: "https://business.test",
    timeoutMs: 5000,
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloClient, { provide: HTTP_CLIENT, useValue: http }, { provide: ZALO_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(ZaloClient), http }
}

describe("ZaloClient / what an error says", () => {
    /** The `body` param of a failure, as text. */
    const bodyOf = (failure: unknown): string =>
        String(Reflect.get(Object(Reflect.get(Object(failure), "params")), "body"))

    it("keeps Zalo's number, its words, the status and the answer, and the endpoint without the query that names a customer", async () => {
        const { client, http } = await build()
        const answer = {
            error: -224,
            message: "Application does not have permission",
            detail: { access_token: "secret-token", note: "x" },
        }
        http.request.mockResolvedValue({ status: 200, body: answer })

        const failure = await client.conversation("token", "user-1", 0).catch((cause: unknown) => cause)

        expect(failure).toMatchObject({
            code: ZaloErrorCode.PlanRestricted,
            params: {
                path: "/v2.0/oa/conversation",
                reason: "Application does not have permission",
                zaloCode: -224,
                status: 200,
            },
        })
        expect(bodyOf(failure)).toContain("Application does not have permission")
        expect(bodyOf(failure)).toContain("[redacted]")
        expect(bodyOf(failure)).not.toContain("secret-token")
    })

    it("cuts a long answer short", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { error: -1, message: "x".repeat(2000) } })

        const failure = await client.recentChats("token", 0).catch((cause: unknown) => cause)

        expect(bodyOf(failure)).toHaveLength(500)
    })

    it("names the status and the answer when Zalo answers an HTTP failure without an error number", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 502, body: { message: "bad gateway" } })

        const failure = await client.recentChats("token", 0).catch((cause: unknown) => cause)

        expect(failure).toMatchObject({
            code: ZaloErrorCode.Unavailable,
            params: {
                path: "/v2.0/oa/listrecentchat",
                reason: "HTTP 502",
                status: 502,
                body: '{"message":"bad gateway"}',
            },
        })
    })

    it("names the status and an empty answer when Zalo answers something that is not an object", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 504, body: undefined })

        const failure = await client.recentChats("token", 0).catch((cause: unknown) => cause)

        expect(failure).toMatchObject({ params: { reason: "HTTP 504", status: 504, body: "" } })
    })

    it("keeps the status and the answer of a refused token exchange, without any token it echoed", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({
            status: 400,
            body: { error: -118, error_name: "invalid code", access_token: "" },
        })

        const failure = await client.exchangeCode("app", "secret", "code", "verifier").catch((cause: unknown) => cause)

        expect(bodyOf(failure)).toBe('{"error":-118,"error_name":"invalid code","access_token":"[redacted]"}')
        expect(failure).toMatchObject({ params: { status: 400 } })
    })
})
