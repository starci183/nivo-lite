import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { McpError, McpErrorCode } from "./errors/mcp.error"
import { publicAddressOf } from "./public-endpoint.policy"

/** How long one request may take when the session's own limit is not shorter. */
const REQUEST_TIMEOUT_MS = 30_000

/** A redirect status: a server may not send the client elsewhere, where the address check would not have run. */
const isRedirect = (status: number): boolean => status >= 300 && status < 400

@Injectable()
/**
 * The `fetch` the MCP SDK sends a session's requests through, over the platform HTTP port. Each request resolves the host here,
 * needs every answer to be public and is pinned to the address answered, so the socket opens where the check looked and a name
 * cannot point inside in between. A redirect is refused, not followed. Only the JSON-RPC POSTs of a call are sent: the server push
 * (a GET) and any other method are declined with 405, since the gateway only calls tools.
 */
export class McpPublicFetchClient {
    constructor(@InjectHttpClient() private readonly http: HttpClient) {}

    /** Sends one request of a session; refused as unavailable when its host is not public or it is redirected. */
    readonly fetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input)
        if (init?.method !== "POST") return new Response(null, { status: 405 })
        const pin = await publicAddressOf(url)
        if (pin === null) throw new McpError({ code: McpErrorCode.Unavailable, params: { url, reason: "private" } })
        const answer = await this.http.request({
            method: "POST",
            url,
            headers: Object.fromEntries(new Headers(init.headers)),
            bytes: Buffer.from(typeof init.body === "string" ? init.body : ""),
            read: "text",
            pin,
            redirect: "manual",
            timeoutMs: REQUEST_TIMEOUT_MS,
            ...(init.signal ? { signal: init.signal } : {}),
        })
        if (isRedirect(answer.status)) {
            throw new McpError({ code: McpErrorCode.Unavailable, params: { url, reason: "redirect" } })
        }
        const text = typeof answer.body === "string" ? answer.body : ""
        return new Response(text === "" ? null : text, { status: answer.status, headers: { ...answer.headers } })
    }
}
