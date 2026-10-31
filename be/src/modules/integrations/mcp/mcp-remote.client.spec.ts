import dns from "node:dns/promises"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { McpErrorCode } from "./errors/mcp.error"
import type { McpJson } from "./mcp.contracts"
import { MCP_OPTIONS } from "./mcp.decorators"
import { McpRemoteClient } from "./mcp-remote.client"
import { McpLogEvent } from "./mcp.log-events"

const OPEN = { url: "https://hakuen.test/mcp", bearer: null }
const SIGNED = { url: "https://hakuen.test/mcp", bearer: new Secret("s3cret") }

/** What the fake server answers to tools/list and tools/call. */
interface Answers {
    readonly tools?: ReadonlyArray<Readonly<Record<string, unknown>>>
    readonly call?: Readonly<Record<string, unknown>>
}

/** A JSON-RPC result response. */
const jsonOf = (id: unknown, result: unknown): Response =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
        status: 200,
        headers: { "content-type": "application/json" },
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

/** The JSON-RPC message one POST of the client carried, read the way a server reads a request body. */
const messageOf = async (init: RequestInit | undefined): Promise<McpJson> => {
    const message: unknown = await new Response(init?.body).json()
    return typeof message === "object" && message !== null ? { ...message } : {}
}

/** A stateless Streamable HTTP MCP server answering JSON, as fetch sees it; the SSE GET is not offered. */
const serverFetch =
    (answers: Answers) =>
    async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (init?.method === "GET") return new Response(null, { status: 405 })
        const message = await messageOf(init)
        if (message.id === undefined) return new Response(null, { status: 202 })
        return jsonOf(message.id, resultOf(String(message.method), answers))
    }

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpRemoteClient,
            { provide: LOGGER, useValue: logger },
            { provide: MCP_OPTIONS, useValue: { clientName: "nivo-spec-client" } },
        ],
    }).compile()
    return { client: moduleRef.get(McpRemoteClient), logger }
}

/** Makes every name resolve to these addresses. */
const resolvingTo = (...addresses: ReadonlyArray<string>) =>
    jest
        .spyOn(dns, "lookup")
        .mockImplementation((): never => Promise.resolve(addresses.map((address) => ({ address, family: 4 }))) as never)

beforeEach(() => {
    resolvingTo("93.184.216.34")
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe("McpRemoteClient.listTools", () => {
    it("lists the tools with defaults for a missing description or schema, without a bearer when the endpoint has none", async () => {
        const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(
            serverFetch({
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
        const { client } = await build()

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
        const posted = fetch.mock.calls.filter(([, init]) => init?.method === "POST")
        expect(posted.map(([, init]) => new Headers(init?.headers).get("authorization"))).toEqual([null, null, null])
    })

    it("sends the bearer the endpoint carries and announces the configured client name", async () => {
        const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(serverFetch({}))
        const { client } = await build()

        await expect(client.listTools(SIGNED, 4000)).resolves.toEqual([])
        const [, init] = fetch.mock.calls[0] ?? []
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer s3cret")
        await expect(messageOf(init)).resolves.toMatchObject({
            method: "initialize",
            params: { clientInfo: { name: "nivo-spec-client", version: "1.0.0" } },
        })
    })
})

describe("McpRemoteClient.ping", () => {
    it("answers when the server answers ping, and unavailable when it cannot be reached", async () => {
        const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(serverFetch({}))
        const { client } = await build()

        await expect(client.ping(OPEN, 4000)).resolves.toBeUndefined()
        const posts = fetch.mock.calls.filter(([, init]) => init?.method === "POST")
        const messages = await Promise.all(posts.map(([, init]) => messageOf(init)))
        expect(messages.map((message) => message.method)).toEqual(["initialize", "notifications/initialized", "ping"])

        fetch.mockRejectedValue(new TypeError("fetch failed"))
        await expect(client.ping(OPEN, 4000)).rejects.toMatchObject({ code: McpErrorCode.Unavailable })
    })
})

describe("McpRemoteClient.call results", () => {
    const callWith = async (call: Readonly<Record<string, unknown>>) => {
        jest.spyOn(globalThis, "fetch").mockImplementation(serverFetch({ call }))
        const { client } = await build()
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
        jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"))
        const { client } = await build()

        await expect(client.call({ endpoint: OPEN, name: "a.b", args: {}, timeoutMs: 4000 })).rejects.toMatchObject({
            code: McpErrorCode.Unavailable,
            params: { url: OPEN.url },
        })
    })

    it("aborts a server slower than the limit and answers timeout", async () => {
        jest.spyOn(globalThis, "fetch").mockImplementation(
            (_url, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        reject(new Error("aborted"))
                    })
                }),
        )
        const { client } = await build()

        await expect(client.call({ endpoint: OPEN, name: "a.b", args: {}, timeoutMs: 20 })).rejects.toMatchObject({
            code: McpErrorCode.Timeout,
        })
    })

    it("logs a session that fails to close and still answers the call", async () => {
        jest.spyOn(globalThis, "fetch").mockImplementation(serverFetch({ call: { structuredContent: { ok: true } } }))
        const closing = new Error("gone")
        jest.spyOn(Client.prototype, "close").mockRejectedValue(closing)
        const { client, logger } = await build()

        await expect(client.call({ endpoint: OPEN, name: "a.b", args: {}, timeoutMs: 4000 })).resolves.toEqual({
            isError: false,
            value: { ok: true },
        })
        expect(logger.error).toHaveBeenCalledWith(McpLogEvent.CloseFailed, closing, { url: OPEN.url })
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
        const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(serverFetch({}))
        resolvingTo("10.0.0.7")
        const { client } = await build()

        await expect(run(client, OPEN)).rejects.toMatchObject({
            code: McpErrorCode.Unavailable,
            params: { reason: "private" },
        })
        expect(fetch).not.toHaveBeenCalled()
    })

    it("refuses a metadata or loopback address given as the host", async () => {
        const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(serverFetch({}))
        const { client } = await build()

        for (const url of ["http://169.254.169.254/mcp", "http://127.0.0.1:3001/mcp", "http://[::1]/mcp"]) {
            await expect(client.ping({ url, bearer: null }, 4000)).rejects.toMatchObject({
                code: McpErrorCode.Unavailable,
            })
        }
        expect(fetch).not.toHaveBeenCalled()
    })

    it("checks the address again at each request, so a name that turns private mid-session is refused", async () => {
        jest.spyOn(globalThis, "fetch").mockImplementation(serverFetch({}))
        const lookup = resolvingTo("93.184.216.34")
        lookup.mockImplementationOnce((): never => Promise.resolve([{ address: "93.184.216.34", family: 4 }]) as never)
        lookup.mockImplementationOnce((): never => Promise.resolve([{ address: "192.168.0.9", family: 4 }]) as never)
        const { client } = await build()

        await expect(client.ping(OPEN, 4000)).rejects.toMatchObject({ code: McpErrorCode.Unavailable })
    })

    it("refuses to follow a redirect, which could lead inside", async () => {
        const fetch = jest
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }))
        const { client } = await build()

        await expect(client.ping(OPEN, 4000)).rejects.toMatchObject({ code: McpErrorCode.Unavailable })
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" })
    })
})
