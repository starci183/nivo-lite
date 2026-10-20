import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { McpSessionOpener } from "./mcp.contracts"

/** Token of the SDK session opener (the official SDK in production, a double in specs). */
export const MCP_SESSION_OPENER: unique symbol = Symbol("integrations.mcp.session-opener")

/** Injects the session opener. Parameter type: McpSessionOpener. */
export const InjectMcpSessionOpener = (): TypedParameterDecorator<McpSessionOpener> =>
    injector<McpSessionOpener>(MCP_SESSION_OPENER)
