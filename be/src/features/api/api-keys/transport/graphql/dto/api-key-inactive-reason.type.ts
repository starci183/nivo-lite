import { registerEnumType } from "@nestjs/graphql"

/**
 * Why a working MCP key is suspended now, derived from its holder's current seat: the holder is no longer an owner or manager
 * (`holder_not_manager`), or left the workspace (`holder_gone`). The key row is kept; it works again when the holder is promoted again.
 */
export const ApiKeyInactiveReason = { holder_not_manager: "holder_not_manager", holder_gone: "holder_gone" } as const

registerEnumType(ApiKeyInactiveReason, { name: "ApiKeyInactiveReason" })
