/** The JSON-RPC 2.0 response of a request; a notification is answered with an empty body. */
export class McpEndpointResponse {
    /** Always "2.0". */
    jsonrpc!: string

    /** The id of the request answered (null for a message that was not one). */
    id!: string | number | null

    /** The result of a successful request. */
    result?: unknown

    /** The JSON-RPC error of a refused request. */
    error?: unknown
}
