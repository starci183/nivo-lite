import {
    createMcpHandler,
    isLegacyRequest,
    McpServer,
    WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server"
import { Injectable } from "@nestjs/common"
import type { McpHttpRequest, McpHttpResponse, McpServeRequest, McpSurface } from "./mcp.contracts"
import type { McpServing } from "./mcp.port"

/** The server NIVO announces to clients. */
const SERVER_INFO = { name: "nivo", title: "NIVO", version: "2.0.0" }

/** The only method the endpoint serves: every JSON-RPC message is one POST (no SSE stream is offered, no session to delete). */
const POST = "POST"

/** The answer to a GET or a DELETE: this stateless endpoint offers no SSE stream and has no session (Streamable HTTP). */
const METHOD_NOT_ALLOWED: McpHttpResponse = { status: 405, headers: { allow: POST }, body: "" }

/** One MCP server (official SDK) over the surface of one caller: `tools/list` lists its tools, `tools/call` runs one. */
const serverOf = (surface: McpSurface): McpServer => {
    const mcp = new McpServer(SERVER_INFO, { capabilities: { tools: {} }, instructions: surface.instructions })
    const listed = new Set(surface.tools.map((tool) => tool.name))
    mcp.server.setRequestHandler("tools/list", () => ({
        tools: surface.tools.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: { ...tool.inputSchema, type: "object" as const },
            outputSchema: { ...tool.outputSchema, type: "object" as const },
            annotations: { ...tool.annotations },
            _meta: { ...tool.meta },
        })),
    }))
    mcp.server.setRequestHandler("tools/call", async (call) => {
        if (!listed.has(call.params.name)) {
            return { content: [{ type: "text" as const, text: `Unknown tool: ${call.params.name}` }], isError: true }
        }
        const answer = await surface.call(call.params.name, { ...call.params.arguments })
        return {
            content: [{ type: "text" as const, text: answer.text }],
            structuredContent: { ...answer.value },
            isError: answer.isError,
        }
    })
    return mcp
}

/** The web-standard request the SDK serves, rebuilt from what the web server received (the parsed body travels beside it). */
const webRequestOf = (request: McpHttpRequest): Request =>
    new Request(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.method === POST && request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    })

/** The SDK's response as plain data the web server writes back. */
const httpResponseOf = async (response: Response): Promise<McpHttpResponse> => {
    const headers: Record<string, string> = {}
    response.headers.forEach((value, name) => {
        headers[name] = value
    })
    return { status: response.status, headers, body: await response.text() }
}

@Injectable()
/**
 * The server side of MCP for a STATELESS Streamable HTTP endpoint with JSON responses, run by the official SDK end to end: a fresh
 * server per request over the caller's surface. A 2026-era request (the per-request `_meta` envelope) goes to the SDK's modern handler
 * (`createMcpHandler`, `legacy: "reject"`, JSON responses); a 2025-era request (an `initialize` handshake, its notifications, plain
 * requests; batches) goes to the SDK's own Streamable HTTP transport with no session id and JSON responses, the established stateless
 * idiom. The SDK negotiates the protocol version (it answers the client's version when it supports it, else its latest), validates the
 * `MCP-Protocol-Version` header (400 for an unsupported one), the `Accept` header (406) and the content type (415), answers a
 * notification 202 with no body, and answers `ping`, unknown methods (-32601) and malformed JSON-RPC (-32600 / -32700). GET and DELETE
 * are answered 405: no SSE stream is offered and there is no session.
 */
export class McpServerService implements McpServing {
    /** Answers one HTTP request of the endpoint for the caller whose tools the surface holds. */
    async serve({ request, surface }: McpServeRequest): Promise<McpHttpResponse> {
        if (request.method !== POST) return METHOD_NOT_ALLOWED
        const web = webRequestOf(request)
        if (await isLegacyRequest(web.clone(), request.body)) {
            const transport = new WebStandardStreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true,
            })
            const mcp = serverOf(surface)
            await mcp.connect(transport)
            try {
                return await httpResponseOf(await transport.handleRequest(web, { parsedBody: request.body }))
            } finally {
                await mcp.close()
            }
        }
        const modern = createMcpHandler(() => serverOf(surface), { legacy: "reject", responseMode: "json", keepAliveMs: 0 })
        try {
            return await httpResponseOf(await modern.fetch(web, { parsedBody: request.body }))
        } finally {
            await modern.close()
        }
    }
}
