import { timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http"
import { parseJsonText } from "@modules/platform/primitives"

/** What the local remote server saw: how many requests carried the expected bearer and how many it refused. */
export interface RemoteServerSeen {
    /** Requests that carried the expected bearer. */
    authorized: number
    /** Requests refused with 401 (no bearer or another one). */
    refused: number
    /** The arguments of each tool call it ran. */
    readonly calls: Array<Readonly<Record<string, unknown>>>
}

/** A local Streamable HTTP MCP server that accepts one bearer credential, for the sealed-credential proofs. */
export interface RemoteServer {
    /** Its endpoint on the loopback host, once it listens. */
    readonly url: string
    /** Starts listening on a free loopback port. */
    readonly listen: () => Promise<void>
    /** What it saw. */
    readonly seen: RemoteServerSeen
    /** Stops it. */
    readonly close: () => Promise<void>
}

/** The parameters of a JSON-RPC message the server reads: the tool arguments of tools/call. */
interface RpcParams {
    readonly arguments?: Readonly<Record<string, unknown>>
}

/** One JSON-RPC message as the server reads it. */
interface RpcMessage {
    readonly id?: unknown
    readonly method?: unknown
    readonly params?: RpcParams
}

/** The one tool the server lists: a read-only quote. */
const QUOTE_TOOL = {
    name: "rates.quote",
    description: "The price of a room type for a number of nights.",
    inputSchema: { type: "object", properties: { nights: { type: "number" } } },
    annotations: { readOnlyHint: true },
}

/** True when the authorization header carries exactly the expected bearer, compared in constant time. */
const carriesBearer = (header: string | undefined, bearer: string): boolean => {
    const expected = Buffer.from(`Bearer ${bearer}`)
    const given = Buffer.from(header ?? "")
    return given.length === expected.length && timingSafeEqual(given, expected)
}

/** The result of one JSON-RPC method (a stateless server: initialize, ping, tools/list and tools/call of the quote tool). */
const resultOf = (message: RpcMessage, seen: RemoteServerSeen): unknown => {
    if (message.method === "initialize") {
        return {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "sealed-credential-proof", version: "1.0.0" },
        }
    }
    if (message.method === "tools/list") return { tools: [QUOTE_TOOL] }
    if (message.method !== "tools/call") return {}
    const args = { ...message.params?.arguments }
    seen.calls.push(args)
    const nights = typeof args.nights === "number" ? args.nights : 1
    return { content: [], structuredContent: { totalVnd: nights * 1_200_000 } }
}

/** The request body read as one JSON-RPC message; anything else reads as an empty message. */
const messageOf = async (request: IncomingMessage): Promise<RpcMessage> => {
    const chunks: Array<Buffer> = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const read = parseJsonText(Buffer.concat(chunks).toString("utf8"))
    return read.ok && typeof read.value === "object" && read.value !== null ? { ...read.value } : {}
}

/** Answers one HTTP request: 401 without the expected bearer, 405 to the SSE GET, else the JSON-RPC answer (202 to a notification). */
const answer = async (
    request: IncomingMessage,
    response: ServerResponse,
    bearer: () => string,
    seen: RemoteServerSeen,
): Promise<void> => {
    if (!carriesBearer(request.headers.authorization, bearer())) {
        seen.refused += 1
        response.writeHead(401).end()
        return
    }
    seen.authorized += 1
    if (request.method !== "POST") {
        response.writeHead(405).end()
        return
    }
    const message = await messageOf(request)
    if (message.id === undefined) {
        response.writeHead(202).end()
        return
    }
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: resultOf(message, seen) }))
}

/** Creates the local server (it listens once `listen` resolves); `bearer` names the one credential it accepts, read on every request. */
export const createRemoteServer = (bearer: () => string): RemoteServer => {
    const seen: RemoteServerSeen = { authorized: 0, refused: 0, calls: [] }
    const http: HttpServer = createServer((request, response) => {
        void answer(request, response, bearer, seen)
    })
    return {
        get url() {
            const address = http.address()
            const port = typeof address === "object" && address !== null ? address.port : 0
            return `http://127.0.0.1:${String(port)}/mcp`
        },
        seen,
        listen: () =>
            new Promise<void>((resolve) => {
                http.listen(0, "127.0.0.1", resolve)
            }),
        close: () =>
            new Promise<void>((resolve) => {
                http.closeAllConnections()
                http.close(() => {
                    resolve()
                })
            }),
    }
}
