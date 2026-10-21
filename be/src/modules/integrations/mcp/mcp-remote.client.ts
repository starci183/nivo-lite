import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { McpError, McpErrorCode } from "./errors/mcp.error"
import type {
    McpCallRequest,
    McpEndpoint,
    McpJson,
    McpRawResult,
    McpRemoteResult,
    McpRemoteTool,
} from "./mcp.contracts"
import { InjectMcpOptions } from "./mcp.decorators"
import { McpLogEvent } from "./mcp.log-events"
import type { McpOptions } from "./mcp.options"
import type { McpRemote } from "./mcp.port"

/** What one session came to: the work's value, or what stopped it. */
type Attempt<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly cause: unknown }

/** The headers and the abort signal every request of a session carries. */
interface SessionRequest {
    /** The headers (the bearer, when the server names a credential). */
    readonly headers: Record<string, string>
    /** Aborts the session at the time limit. */
    readonly signal: AbortSignal
}

/** The client name NIVO announces to remote servers. */
const CLIENT_INFO = { name: "nivo-mcp-gateway", version: "1.0.0" }

const isJson = (value: unknown): value is McpJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The first text block of a result. */
const firstText = (content: unknown): string => {
    const blocks: ReadonlyArray<unknown> = [content].flat()
    const block = blocks.find((entry): entry is McpJson => isJson(entry) && entry.type === "text")
    return typeof block?.text === "string" ? block.text : ""
}

/** The value of a result: the structured content, else the first text read as a JSON object, else that text under `text`. */
const valueOfResult = (raw: McpRawResult): McpRemoteResult => {
    const isError = raw.isError === true
    if (isJson(raw.structuredContent)) return { isError, value: raw.structuredContent }
    const text = firstText(raw.content)
    const read = parseJsonText(text)
    return { isError, value: read.ok && isJson(read.value) ? read.value : { text } }
}

@Injectable()
/**
 * The client of remote MCP servers, over the official TypeScript SDK and Streamable HTTP. Every call opens a short session bounded
 * by the caller's time limit: a server slower than the limit is aborted and answers `MCP_TIMEOUT`; anything else outside the protocol
 * answers `MCP_UNAVAILABLE`. A tool's own refusal is a result (`isError`), not an error. The bearer is read here by the NAME the
 * connector gives, so a secret value never leaves this integration.
 */
export class McpRemoteClient implements McpRemote {
    constructor(
        @InjectMcpOptions() private readonly options: McpOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when this integration holds the credential of that NAME. */
    holds(credentialRef: string): boolean {
        return this.options.credentials.has(credentialRef)
    }

    /** The tools the server lists. */
    async listTools(endpoint: McpEndpoint, timeoutMs: number): Promise<ReadonlyArray<McpRemoteTool>> {
        const listed = await this.within(endpoint, timeoutMs, (client, signal) =>
            client.listTools(undefined, { signal }),
        )
        return listed.tools.map((tool) => ({
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: { ...tool.inputSchema },
            annotations: { ...tool.annotations },
            meta: { ...tool._meta },
        }))
    }

    /** Checks that the server answers MCP at all (`ping`), within the time limit. */
    async ping(endpoint: McpEndpoint, timeoutMs: number): Promise<void> {
        await this.within(endpoint, timeoutMs, (client, signal) => client.ping({ signal }))
    }

    /** Calls one tool by its remote name. */
    async call(request: McpCallRequest): Promise<McpRemoteResult> {
        const raw: McpRawResult = await this.within(request.endpoint, request.timeoutMs, (client, signal) =>
            client.callTool({ name: request.name, arguments: { ...request.args } }, undefined, { signal }),
        )
        return valueOfResult(raw)
    }

    /** The headers of a server: its bearer when it names a credential, which must be one this integration holds. */
    private headersOf(endpoint: McpEndpoint): Record<string, string> {
        if (endpoint.credentialRef === null) return {}
        const secret = this.options.credentials.get(endpoint.credentialRef)
        if (secret === undefined) {
            throw new McpError({ code: McpErrorCode.CredentialMissing, params: { ref: endpoint.credentialRef } })
        }
        return { Authorization: `Bearer ${secret.reveal()}` }
    }

    private async within<T>(
        endpoint: McpEndpoint,
        timeoutMs: number,
        work: (client: Client, signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
        const headers = this.headersOf(endpoint)
        const signal = AbortSignal.timeout(timeoutMs)
        const client = new Client(CLIENT_INFO)
        const attempt = await this.attempt(client, endpoint, { headers, signal }, work)
        await client.close().catch((cause: unknown) => {
            this.logger.error(McpLogEvent.CloseFailed, cause, { url: endpoint.url })
        })
        if (!attempt.ok) {
            const code = signal.aborted ? McpErrorCode.Timeout : McpErrorCode.Unavailable
            throw new McpError({ code, params: { url: endpoint.url }, cause: attempt.cause })
        }
        return attempt.value
    }

    /** Opens the session and runs the work, answering what came of it; the caller closes the session either way. */
    private async attempt<T>(
        client: Client,
        endpoint: McpEndpoint,
        request: SessionRequest,
        work: (client: Client, signal: AbortSignal) => Promise<T>,
    ): Promise<Attempt<T>> {
        try {
            const transport = new StreamableHTTPClientTransport(new URL(endpoint.url), { requestInit: request })
            await client.connect(transport, { signal: request.signal })
            return { ok: true, value: await work(client, request.signal) }
        } catch (cause) {
            return { ok: false, cause }
        }
    }
}
