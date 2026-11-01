import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { resolvingTo } from "@tests/world/dns-lookup.adapter"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import { parseJsonText } from "@modules/platform/primitives"
import type { HttpClient, HttpRequest, HttpResponse } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { McpErrorCode } from "./errors/mcp.error"
import type { McpJson } from "./mcp.contracts"
import { MCP_OPTIONS } from "./mcp.decorators"
import { McpPublicFetchClient } from "./mcp-public-fetch.client"
import { McpRemoteClient } from "./mcp-remote.client"
import { McpLogEvent } from "./mcp.log-events"

const OPEN = { url: "https://hakuen.test/mcp", bearer: null }
const SIGNED = { url: "https://hakuen.test/mcp", bearer: new Secret("s3cret") }
const PUBLIC = "93.184.216.34"

/** What the fake server answers to tools/list and tools/call. */
interface Answers {
    readonly tools?: ReadonlyArray<Readonly<Record<string, unknown>>>
    readonly call?: Readonly<Record<string, unknown>>
}

/** A JSON-RPC result response, as the HTTP port answers it. */
const jsonOf = (id: unknown, result: unknown): HttpResponse => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, result }),
})

/** The result of one JSON-RPC method of the fake server. */
const resultOf = (method: string, answers: Answers): unknown => {
    if (method === "initialize") {
        return {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "fake", version: "1" },
        }
    }
    if (method === "tools/list") return { tools: answers.tools ?? [] }
    return answers.call ?? {}
}

/** The JSON-RPC message one request of the client carried. */
const messageOf = (request: HttpRequest | undefined): McpJson => {
    const read = parseJsonText(request?.bytes?.toString() ?? "{}")
    return read.ok && typeof read.value === "object" && read.value !== null ? { ...read.value } : {}
}

/** A stateless Streamable HTTP MCP server answering JSON through the HTTP port. */
const serverHttp =
    (answers: Answers) =>
    (request: HttpRequest): Promise<HttpResponse> => {
        const message = messageOf(request)
        if (message.id === undefined) return Promise.resolve({ status: 202, body: "" })
        return Promise.resolve(jsonOf(message.id, resultOf(String(message.method), answers)))
    }

const build = async () => {
    const logger = mock<Logger>()
    const http = mock<HttpClient>()
    http.request.mockImplementation(serverHttp({}))
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpRemoteClient,
            McpPublicFetchClient,
            { provide: LOGGER, useValue: logger },
            { provide: HTTP_CLIENT, useValue: http },
            { provide: MCP_OPTIONS, useValue: { clientName: "nivo-spec-client" } },
        ],
    }).compile()
    return { client: moduleRef.get(McpRemoteClient), logger, http }
}

beforeEach(() => {
    resolvingTo(PUBLIC)
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe("McpRemoteClient.listTools", () => {
    it("lists the tools with defaults for a missing description or schema, without a bearer when the endpoint has none", async () => {
        const { client, http } = await build()
        http.request.mockImplementation(
            serverHttp({
                tools: [
                    {
                        name: "order.hold",
                        description: "Hold",
                        inputSchema: { type: "object" },
                        annotations: { readOnlyHint: false },
                        _meta: { "nivo/role": "identity.upsert" },
                    },
                    { name: "stock.search", inputSchema: { type: "object" } },
                ],
            }),
        )

        await expect(client.listTools(OPEN, 4000)).resolves.toEqual([
            {
                name: "order.hold",
                description: "Hold",
                inputSchema: { type: "object" },
                annotations: { readOnlyHint: false },
                meta: { "nivo/role": "identity.upsert" },
            },
            { name: "stock.search", description: "", inputSchema: { type: "object" }, annotations: {}, meta: {} },
        ])
        expect(http.request.mock.calls.map(([request]) => request.headers?.authorization)).toEqual([
            undefined,
            undefined,
            undefined,
        ])
    })

    it("sends the bearer the endpoint carries and announces the configured client name", async () => {
        const { client, http } = await build()

        await expect(client.listTools(SIGNED, 4000)).resolves.toEqual([])
        const [request] = http.request.mock.calls[0] ?? []
        expect(request?.headers?.authorization).toBe("Bearer s3cret")
        expect(messageOf(request)).toMatchObject({
            method: "initialize",
            params: { clientInfo: { name: "nivo-spec-client", version: "1.0.0" } },
        })
    })
})

describe("McpRemoteClient.ping", () => {
    it("answers when the server answers ping, and unavailable when it cannot be reached", async () => {
        const { client, http } = await build()

        await expect(client.ping(OPEN, 4000)).resolves.toBeUndefined()
        expect(http.request.mock.calls.map(([request]) => messageOf(request).method)).toEqual([
            "initialize",
            "notifications/initialized",
            "ping",
        ])

        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network }))
        await expect(client.ping(OPEN, 4000)).rejects.toMatchObject({ code: McpErrorCode.Unavailable })
    })
})

describe("McpRemoteClient.call results", () => {
    const callWith = async (call: Readonly<Record<string, unknown>>) => {
        const { client, http } = await build()
        http.request.mockImplementation(serverHttp({ call }))
        return client.call({ endpoint: OPEN, name: "booking.hold", args: { roomType: "deluxe" }, timeoutMs: 4000 })
    }

    it("prefers the structured content and keeps the error flag", async () => {
        await expect(callWith({ content: [], structuredContent: { holdId: "h1" }, isError: true })).resolves.toEqual({
            isError: true,
            value: { holdId: "h1" },
        })
    })

    it("reads the first text block as a JSON object", async () => {
        await expect(callWith({ content: [{ type: "text", text: '{"holdId":"h2"}' }] })).resolves.toEqual({
            isError: false,
            value: { holdId: "h2" },
        })
    })

    it("keeps a text that is not a JSON object under text, and an empty text when there is none", async () => {
        await expect(callWith({ content: [{ type: "text", text: "[1]" }] })).resolves.toEqual({
            isError: false,
            value: { text: "[1]" },
        })
        await expect(callWith({ content: [{ type: "text", text: "nope" }] })).resolves.toEqual({
            isError: false,
            value: { text: "nope" },
        })
        await expect(callWith({ content: [] })).resolves.toEqual({ isError: false, value: { text: "" } })
    })
})

describe("McpRemoteClient.call failures", () => {
    it("answers unavailable when the server cannot be reached", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network }))

        await expect(client.call({ endpoint: OPEN, name: "a.b", args: {}, timeoutMs: 4000 })).rejects.toMatchObject({
            code: McpErrorCode.Unavailable,
            params: { url: OPEN.url },
        })
    })

    it("aborts a server slower than the limit and answers timeout", async () => {
        const { client, http } = await build()
        http.request.mockImplementation(
            (request) =>
                new Promise<HttpResponse>((_resolve, reject) => {
                    request.signal?.addEventListener("abort", () => {
                        reject(new HttpError({ code: HttpErrorCode.Timeout }))
                    })
                }),
        )

        await expect(client.call({ endpoint: OPEN, name: "a.b", args: {}, timeoutMs: 20 })).rejects.toMatchObject({
            code: McpErrorCode.Timeout,
        })
    })

    it("logs a session that fails to close and still answers the call", async () => {
        const { client, http, logger } = await build()
        http.request.mockImplementation(serverHttp({ call: { structuredContent: { ok: true } } }))
        const closing = new Error("gone")
        jest.spyOn(Client.prototype, "close").mockRejectedValue(closing)

        await expect(client.call({ endpoint: OPEN, name: "a.b", args: {}, timeoutMs: 4000 })).resolves.toEqual({
            isError: false,
            value: { ok: true },
        })
        expect(logger.error).toHaveBeenCalledWith(McpLogEvent.CloseFailed, closing, { url: OPEN.url })
    })
})

describe("McpRemoteClient.isReachable", () => {
    it("is true for a public address and false for one inside or one that is no http(s) URL", async () => {
        const { client } = await build()

        await expect(client.isReachable(OPEN.url)).resolves.toBe(true)
        await expect(client.isReachable("http://10.0.0.1/mcp")).resolves.toBe(false)
        await expect(client.isReachable("ftp://hakuen.test/mcp")).resolves.toBe(false)
    })
})

describe("McpRemoteClient private addresses", () => {
    const calls = [
        ["listTools", (client: McpRemoteClient, endpoint: typeof OPEN) => client.listTools(endpoint, 4000)],
        ["ping", (client: McpRemoteClient, endpoint: typeof OPEN) => client.ping(endpoint, 4000)],
        [
            "call",
            (client: McpRemoteClient, endpoint: typeof OPEN) =>
                client.call({ endpoint, name: "a.b", args: {}, timeoutMs: 4000 }),
        ],
    ] as const

    it.each(calls)("refuses a name that resolves inside before %s connects", async (_name, run) => {
        const { client, http } = await build()
        resolvingTo("10.0.0.7")

        await expect(run(client, OPEN)).rejects.toMatchObject({
            code: McpErrorCode.Unavailable,
            params: { reason: "private" },
        })
        expect(http.request).not.toHaveBeenCalled()
    })

    it.each(["http://169.254.169.254/mcp", "http://127.0.0.1:3001/mcp", "http://[::1]/mcp"])(
        "refuses %s given as the host",
        async (url) => {
            const { client, http } = await build()

            await expect(client.ping({ url, bearer: null }, 4000)).rejects.toMatchObject({
                code: McpErrorCode.Unavailable,
            })
            expect(http.request).not.toHaveBeenCalled()
        },
    )

    it("pins every request to the public address it resolved and never lets the port resolve the name again", async () => {
        const { client, http } = await build()

        await client.ping(OPEN, 4000)

        expect(http.request.mock.calls.length).toBeGreaterThan(0)
        for (const [request] of http.request.mock.calls) {
            expect(request.pin).toEqual({ address: PUBLIC, family: 4 })
            expect(request.redirect).toBe("manual")
            expect(request.method).toBe("POST")
        }
    })

    it("checks the address again at each request, so a name that turns private mid-session is refused", async () => {
        const { client, http } = await build()
        const lookup = resolvingTo(PUBLIC)
        lookup.mockResolvedValueOnce([{ address: PUBLIC, family: 4 }])
        lookup.mockResolvedValueOnce([{ address: PUBLIC, family: 4 }])
        lookup.mockResolvedValue([{ address: "192.168.0.9", family: 4 }])

        await expect(client.ping(OPEN, 4000)).rejects.toMatchObject({ code: McpErrorCode.Unavailable })
        expect(http.request.mock.calls.length).toBeLessThan(3)
    })

    it("refuses to follow a redirect, which could lead inside", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 302, headers: { location: "http://169.254.169.254/" }, body: "" })

        await expect(client.ping(OPEN, 4000)).rejects.toMatchObject({ code: McpErrorCode.Unavailable })
        expect(http.request).toHaveBeenCalledTimes(1)
    })
})
