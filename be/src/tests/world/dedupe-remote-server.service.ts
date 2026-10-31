import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import { parseJsonText } from "@modules/platform/primitives"
import { allowingLoopback } from "./loopback-mcp.world"

/** The local connector's one write; the gateway derives the same replay key on every delivery. */
const HOLD_TOOL = {
    name: "booking.hold",
    description: "Holds one room for a guest.",
    inputSchema: {
        type: "object",
        properties: { roomType: { type: "string" }, idempotencyKey: { type: "string" } },
    },
    annotations: { readOnlyHint: false },
}

/** The tool arguments of one tools/call request. */
interface RpcParams {
    readonly arguments?: Readonly<Record<string, unknown>>
}

/** One JSON-RPC message read by the local connector. */
interface RpcMessage {
    readonly id?: unknown
    readonly method?: unknown
    readonly params?: RpcParams
}

const bytesOf = (chunk: unknown): Buffer => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))

const messageOf = async (request: IncomingMessage): Promise<RpcMessage> => {
    const chunks: Array<Buffer> = []
    for await (const chunk of request) chunks.push(bytesOf(chunk))
    const read = parseJsonText(Buffer.concat(chunks).toString("utf8"))
    return read.ok && typeof read.value === "object" && read.value !== null ? { ...read.value } : {}
}

/** A loopback-only HAKUEN-shaped MCP server for durable inbox regressions; it counts effects independently of NIVO's claim. */
export const createDedupeRemoteServer = () => {
    const calls: Array<Readonly<Record<string, unknown>>> = []
    let allowing: jest.SpyInstance | null = null
    const resultOf = (message: RpcMessage): unknown => {
        if (message.method === "initialize") {
            return {
                protocolVersion: "2025-06-18",
                capabilities: { tools: {} },
                serverInfo: { name: "inbox-dedupe-regression", version: "1.0.0" },
            }
        }
        if (message.method === "tools/list") return { tools: [HOLD_TOOL] }
        if (message.method !== "tools/call") return {}
        calls.push({ ...message.params?.arguments })
        return { content: [], structuredContent: { holdId: `hold-${String(calls.length)}` } }
    }
    const answer = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
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
        response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: resultOf(message) }))
    }
    const http = createServer((request, response) => {
        void answer(request, response)
    })
    return {
        calls,
        get url(): string {
            const address = http.address()
            const port = typeof address === "object" && address !== null ? address.port : 0
            return `http://127.0.0.1:${String(port)}/mcp`
        },
        listen: () =>
            new Promise<void>((resolve) => {
                allowing = allowingLoopback("127.0.0.1")
                http.listen(0, "127.0.0.1", resolve)
            }),
        close: () =>
            new Promise<void>((resolve) => {
                allowing?.mockRestore()
                http.closeAllConnections()
                http.close(() => resolve())
            }),
    }
}
