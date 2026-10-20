import { Injectable } from "@nestjs/common"
import { McpError, McpErrorCode } from "./errors/mcp.error"
import { InjectMcpSessionOpener } from "./mcp.decorators"
import type {
    McpEndpoint,
    McpRawResult,
    McpRemoteResult,
    McpRemoteTool,
    McpSession,
    McpSessionOpener,
} from "./mcp.contracts"

type Loose = Readonly<Record<string, unknown>>

const isLoose = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value)

const parseLoose = (text: string): Loose | null => {
    try {
        const value: unknown = JSON.parse(text)
        return isLoose(value) ? value : null
    } catch {
        return null
    }
}

/** The first text block of a result. */
const firstText = (content: unknown): string => {
    const blocks: ReadonlyArray<unknown> = Array.isArray(content) ? content : []
    const block = blocks.find((entry): entry is Loose => isLoose(entry) && entry.type === "text")
    return typeof block?.text === "string" ? block.text : ""
}

/** The value of a result: the structured content, else the first text read as JSON, else that text under `text`. */
export const valueOfResult = (raw: McpRawResult): McpRemoteResult => {
    const isError = raw.isError === true
    if (isLoose(raw.structuredContent)) return { isError, value: raw.structuredContent }
    const text = firstText(raw.content)
    return { isError, value: parseLoose(text) ?? { text } }
}

@Injectable()
/**
 * The client of remote MCP servers, over the official TypeScript SDK and Streamable HTTP. Every call opens a short session bounded by
 * the caller's time limit: a server slower than the limit is aborted and answers `MCP_TIMEOUT`; anything else outside the protocol
 * answers `MCP_UNAVAILABLE`. A tool's own refusal is a result (`isError`), not an error.
 */
export class McpRemoteClient {
    constructor(@InjectMcpSessionOpener() private readonly open: McpSessionOpener) {}

    /** The tools the server lists. */
    async listTools(endpoint: McpEndpoint, timeoutMs: number): Promise<ReadonlyArray<McpRemoteTool>> {
        const listed = await this.within(endpoint, timeoutMs, (session) => session.listTools())
        return listed.tools.map((tool) => ({
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: isLoose(tool.inputSchema) ? tool.inputSchema : {},
        }))
    }

    /** Calls one tool by its remote name. */
    async call(
        endpoint: McpEndpoint,
        name: string,
        args: Readonly<Record<string, unknown>>,
        timeoutMs: number,
    ): Promise<McpRemoteResult> {
        return valueOfResult(await this.within(endpoint, timeoutMs, (session) => session.callTool(name, args)))
    }

    private async within<T>(
        endpoint: McpEndpoint,
        timeoutMs: number,
        work: (session: McpSession) => Promise<T>,
    ): Promise<T> {
        const controller = new AbortController()
        let timedOut = false
        const timer = setTimeout(() => {
            timedOut = true
            controller.abort()
        }, timeoutMs)
        let session: McpSession | null = null
        try {
            session = await this.open(endpoint, controller.signal)
            return await work(session)
        } catch (cause) {
            const code = timedOut ? McpErrorCode.Timeout : McpErrorCode.Unavailable
            throw new McpError({ code, params: { url: endpoint.url }, cause })
        } finally {
            clearTimeout(timer)
            if (session !== null) await session.close().catch(() => undefined)
        }
    }
}
