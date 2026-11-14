import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { McpServing } from "./mcp.port"

/** Token of the MCP server side. */
export const MCP_SERVER: unique symbol = Symbol("integrations.mcp.server")

/** Injects the MCP server side. Parameter type: McpServing. */
export const InjectMcpServer = (): TypedParameterDecorator<McpServing> => injector<McpServing>(MCP_SERVER)
