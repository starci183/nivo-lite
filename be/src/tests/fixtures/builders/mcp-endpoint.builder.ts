import { jsonTextOf } from "@tests/fixtures/builders/json-text.builder"
import type { NivoApiAnswer, NivoApiExecutor } from "@modules/domain/nivo-api"
import type { SurfaceReply } from "@modules/domain/mcp-endpoint"
import type { McpHttpRequest, McpJson } from "@modules/integrations/mcp"

/**
 * The data-op executor of a world that proves only the node-tool road of the outbound MCP surface: it runs no data op (the data ops are
 * proven by the unit specs of the executor and the surface over the same handlers).
 */
export class NoDataOpsExecutor implements NivoApiExecutor {
    /** Refuses every data op. */
    execute(): Promise<NivoApiAnswer> {
        return Promise.resolve({ ok: false, code: "not_exposed" })
    }
}

/** The headers a Streamable HTTP client sends with a JSON-RPC POST. */
const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" }

/** One JSON-RPC POST to the canonical endpoint. */
export const mcpPost = (body: McpJson): McpHttpRequest => ({
    method: "POST",
    url: "https://mcp.nivo.test/mcp",
    headers: HEADERS,
    body,
})

/** A `tools/call` of `nivo_call` running one op (a node tool `nivo.tool.*` for an agent-scoped key) with its arguments. */
export const mcpCallOf = (name: string, args: Readonly<Record<string, unknown>>, opKey?: string): McpHttpRequest =>
    mcpPost({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "nivo_call", arguments: { name, args, ...(opKey === undefined ? {} : { opKey }) } },
    })

/** The JSON-RPC answer of a reply. */
export const rpcOf = (reply: SurfaceReply): McpJson => {
    const parsed: unknown = jsonTextOf(reply.body)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("the reply is no JSON-RPC object")
    return { ...parsed }
}
