import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { resolvingTo } from "@tests/world/dns-lookup.adapter"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { McpErrorCode } from "./errors/mcp.error"
import { McpPublicFetchClient } from "./mcp-public-fetch.client"

const URL_OK = "https://hakuen.test/mcp"
const PAYLOAD = JSON.stringify({ id: 1 })
const EMPTY = ""

const build = async () => {
    const http = mock<HttpClient>()
    http.request.mockResolvedValue({
        status: 200,
        headers: { "content-type": "application/json" },
        body: '{"ok":true}',
    })
    const moduleRef = await Test.createTestingModule({
        providers: [McpPublicFetchClient, { provide: HTTP_CLIENT, useValue: http }],
    }).compile()
    return { client: moduleRef.get(McpPublicFetchClient), http }
}

beforeEach(() => {
    resolvingTo("93.184.216.34")
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe("McpPublicFetchClient.fetch", () => {
    it("sends the POST through the port, pinned to the public address, redirects not followed, and answers a Response", async () => {
        const { client, http } = await build()
        const signal = AbortSignal.timeout(5000)

        const response = await client.fetch(URL_OK, {
            method: "POST",
            headers: { authorization: "Bearer s3cret", "content-type": "application/json" },
            body: PAYLOAD,
            signal,
        })

        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: URL_OK,
            headers: { authorization: "Bearer s3cret", "content-type": "application/json" },
            bytes: Buffer.from(PAYLOAD),
            read: "text",
            pin: { address: "93.184.216.34", family: 4 },
            redirect: "manual",
            timeoutMs: 30_000,
            signal,
        })
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ ok: true })
    })

    it("answers an empty body as a Response with none, and one the port could not read as an empty text", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 202, body: EMPTY })
        http.request.mockResolvedValueOnce({ status: 200, body: { parsed: true } })

        const accepted = await client.fetch(URL_OK, { method: "POST", body: PAYLOAD })
        const odd = await client.fetch(URL_OK, { method: "POST", body: PAYLOAD })

        expect(accepted.status).toBe(202)
        await expect(accepted.text()).resolves.toBe("")
        await expect(odd.text()).resolves.toBe("")
        expect(http.request.mock.calls[0]?.[0]).not.toHaveProperty("signal")
    })

    it("sends a POST without a text body as an empty one", async () => {
        const { client, http } = await build()

        await client.fetch(URL_OK, { method: "POST" })

        expect(http.request.mock.calls[0]?.[0].bytes).toEqual(Buffer.from(EMPTY))
    })

    it("declines the server push and any method but POST without touching the network", async () => {
        const { client, http } = await build()

        for (const init of [undefined, { method: "GET" }, { method: "DELETE" }]) {
            await expect(client.fetch(URL_OK, init)).resolves.toMatchObject({ status: 405 })
        }
        expect(http.request).not.toHaveBeenCalled()
    })

    it("refuses a host that is not public before sending anything", async () => {
        const { client, http } = await build()
        resolvingTo("10.0.0.7")

        await expect(client.fetch(URL_OK, { method: "POST", body: PAYLOAD })).rejects.toMatchObject({
            code: McpErrorCode.Unavailable,
            params: { reason: "private" },
        })
        expect(http.request).not.toHaveBeenCalled()
    })

    it.each([301, 302, 307, 308])("refuses a %s redirect instead of following it", async (status) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, headers: { location: "http://169.254.169.254/" }, body: EMPTY })

        await expect(client.fetch(URL_OK, { method: "POST", body: PAYLOAD })).rejects.toMatchObject({
            code: McpErrorCode.Unavailable,
            params: { reason: "redirect" },
        })
    })
})
