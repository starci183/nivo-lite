/**
 * The api-keys capability's options: the public base URL the mcp app is reached at (`MCP_PUBLIC_URL`, for example
 * `https://mcp.example.com`), from which an MCP key's endpoint (`<base>/mcp`) is answered; undefined when the deployment publishes no
 * MCP route (the endpoint is then answered null). The app root decides whether the capability is global.
 */
export interface ApiKeysOptions {
    /** The public base URL of the mcp app, or undefined. */
    readonly mcpPublicUrl?: string | undefined
}
