import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HttpErrorCode } from "./errors/http.error"
import { FetchHttpClient } from "./fetch-http-client.client"
import type { HttpRequest } from "./http.port"
import * as pinnedRequest from "./pinned-request.client"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A by-constructor matcher, typed `unknown` so it flows into any slot. */
const anyOf = (type: unknown): unknown => expect.any(type)

const build = async (): Promise<FetchHttpClient> => {
    const moduleRef = await Test.createTestingModule({ providers: [FetchHttpClient] }).compile()
    return moduleRef.get(FetchHttpClient)
}

const responseOf = (status = 200) =>
    mock<Response>({
        status,
        url: "https://service.test/final",
        headers: new Headers({ "Content-Type": "text/plain" }),
    })

const HEADERS = { "content-type": "text/plain" }
const FINAL = "https://service.test/final"

afterEach(() => {
    jest.restoreAllMocks()
})

describe("FetchHttpClient", () => {
    it("sends a JSON request and parses its JSON response", async () => {
        const client = await build()
        const response = responseOf(201)
        response.text.mockResolvedValue('{"created":true}')
        const send = jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({
                method: "POST",
                url: "https://service.test/orders",
                headers: { authorization: "Bearer token" },
                body: { orderId: "order-1" },
                timeoutMs: 2500,
            }),
        ).resolves.toEqual({ status: 201, headers: HEADERS, url: FINAL, body: { created: true } })

        expect(send).toHaveBeenCalledWith("https://service.test/orders", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: "Bearer token" },
            body: JSON.stringify({ orderId: "order-1" }),
            redirect: "follow",
            signal: anyOf(AbortSignal),
        })
    })

    it("returns undefined for an empty response body", async () => {
        const client = await build()
        const response = responseOf(204)
        response.text.mockResolvedValue("")
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/health", timeoutMs: 2500 }),
        ).resolves.toEqual({ status: 204, headers: HEADERS, url: FINAL, body: undefined })

        expect(fetch).toHaveBeenCalledWith("https://service.test/health", objectLike({ headers: {} }))
    })

    it("preserves a redirect response when the caller requests manual redirects", async () => {
        const client = await build()
        const response = responseOf(302)
        response.headers.set("location", "/login")
        response.text.mockResolvedValue("")
        const send = jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", redirect: "manual", timeoutMs: 2500 }),
        ).resolves.toEqual({
            status: 302,
            headers: { ...HEADERS, location: "/login" },
            url: FINAL,
            body: undefined,
        })
        expect(send).toHaveBeenCalledWith("https://service.test/orders", {
            method: "GET",
            headers: {},
            body: undefined,
            redirect: "manual",
            signal: anyOf(AbortSignal),
        })
    })
})

describe("FetchHttpClient", () => {
    it("reads the body as text when the request asks for it, even when it is not JSON", async () => {
        const client = await build()
        const response = responseOf(502)
        response.text.mockResolvedValue("<html>bad gateway</html>")
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/page", read: "text", timeoutMs: 2500 }),
        ).resolves.toEqual({ status: 502, headers: HEADERS, url: FINAL, body: "<html>bad gateway</html>" })
    })

    it("encodes form fields and combines a caller cancellation signal with the deadline", async () => {
        const client = await build()
        const response = responseOf()
        response.text.mockResolvedValue("{}")
        const send = jest.spyOn(global, "fetch").mockResolvedValue(response)
        const caller = new AbortController()

        await client.request({
            method: "POST",
            url: "https://service.test/token",
            form: { grant_type: "client_credentials", scope: "orders read" },
            timeoutMs: 2500,
            signal: caller.signal,
        })

        expect(send).toHaveBeenCalledWith(
            "https://service.test/token",
            objectLike({
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: "grant_type=client_credentials&scope=orders+read",
                signal: anyOf(AbortSignal),
            }),
        )
        expect(send.mock.calls[0]?.[1]?.signal).not.toBe(caller.signal)
    })

    it("sends and receives raw bytes", async () => {
        const client = await build()
        const response = responseOf(206)
        response.arrayBuffer.mockResolvedValue(Uint8Array.from([4, 5, 6]).buffer)
        const send = jest.spyOn(global, "fetch").mockResolvedValue(response)
        const bytes = Buffer.from([1, 2, 3])

        await expect(
            client.request({
                method: "PUT",
                url: "https://service.test/object",
                bytes,
                read: "bytes",
                timeoutMs: 2500,
            }),
        ).resolves.toEqual({ status: 206, headers: HEADERS, url: FINAL, body: Buffer.from([4, 5, 6]) })

        expect(send).toHaveBeenCalledWith(
            "https://service.test/object",
            objectLike({ headers: { "content-type": "application/octet-stream" }, body: bytes }),
        )
    })

    it("reports a response that is not JSON", async () => {
        const client = await build()
        const response = responseOf()
        response.text.mockResolvedValue("not JSON")
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.BodyUnreadable, cause: anyOf(SyntaxError) })
    })
})

describe("FetchHttpClient", () => {
    it("maps a failure before headers to a network error", async () => {
        const client = await build()
        jest.spyOn(global, "fetch").mockRejectedValue("connection refused")

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Network, cause: "connection refused" })
    })

    it.each([null, {}])("maps a non-error rejection (%p) to a network error", async (cause) => {
        const client = await build()
        jest.spyOn(global, "fetch").mockRejectedValue(cause)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Network, cause })
    })

    it("maps a deadline failure before headers to a timeout", async () => {
        const client = await build()
        const failure = { name: "TimeoutError" }
        jest.spyOn(global, "fetch").mockRejectedValue(failure)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Timeout, cause: failure })
    })

    it("maps a failure while reading a response to a network error", async () => {
        const client = await build()
        const failure = new Error("stream cut")
        const response = responseOf()
        response.text.mockRejectedValue(failure)
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({ method: "GET", url: "https://service.test/orders", timeoutMs: 2500 }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Network, cause: failure })
    })

    it("maps a deadline while reading bytes to a timeout", async () => {
        const client = await build()
        const failure = { name: "TimeoutError" }
        const response = responseOf()
        response.arrayBuffer.mockRejectedValue(failure)
        jest.spyOn(global, "fetch").mockResolvedValue(response)

        await expect(
            client.request({
                method: "GET",
                url: "https://service.test/object",
                read: "bytes",
                timeoutMs: 2500,
            }),
        ).rejects.toMatchObject({ code: HttpErrorCode.Timeout, cause: failure })
    })
})

describe("FetchHttpClient", () => {
    it.each<{
        name: string
        read: HttpRequest["read"]
        raw: Buffer
        body: unknown
    }>([
        { name: "JSON", read: "json", raw: Buffer.from('{"created":true}'), body: { created: true } },
        { name: "empty JSON", read: "json", raw: Buffer.alloc(0), body: undefined },
        { name: "text", read: "text", raw: Buffer.from("<html>created</html>"), body: "<html>created</html>" },
        { name: "bytes", read: "bytes", raw: Buffer.from([4, 5, 6]), body: Buffer.from([4, 5, 6]) },
    ])("reads a pinned $name response without using fetch", async ({ read, raw, body }) => {
        const client = await build()
        const pin = { address: "203.0.113.5", family: 4 } as const
        const send = jest.spyOn(pinnedRequest, "sendPinned").mockResolvedValue({
            status: 201,
            headers: HEADERS,
            body: raw,
        })
        const fetch = jest.spyOn(global, "fetch").mockRejectedValue(new Error("unexpected fetch"))

        await expect(
            client.request({
                method: "POST",
                url: "https://service.test/orders",
                headers: { "content-type": "application/vnd.orders+json" },
                body: { orderId: "order-1" },
                timeoutMs: 2500,
                redirect: "follow",
                pin,
                read,
            }),
        ).resolves.toEqual({ status: 201, headers: HEADERS, url: "https://service.test/orders", body })
        expect(send).toHaveBeenCalledWith(new URL("https://service.test/orders"), pin, {
            method: "POST",
            headers: { "content-type": "application/vnd.orders+json" },
            body: JSON.stringify({ orderId: "order-1" }),
            timeoutMs: 2500,
            signal: anyOf(AbortSignal),
        })
        expect(fetch).not.toHaveBeenCalled()
    })
})
