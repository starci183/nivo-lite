import { registerEnumType } from "@nestjs/graphql"

/**
 * What a key is for: `mcp` (the outbound MCP endpoint; it runs as its holder, optionally scoped to one agent) or `public_api` (the
 * public REST API scopes).
 */
export const ApiKeyKind = { mcp: "mcp", public_api: "public_api" } as const

registerEnumType(ApiKeyKind, { name: "ApiKeyKind" })
