import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { McpOptions } from "./mcp.options"
import type { McpRemote, McpServing } from "./mcp.port"

/** Token of the MCP integration options. */
export const MCP_OPTIONS: unique symbol = Symbol("integrations.mcp.options")

/** Injects the MCP integration options. Parameter type: McpOptions. */
export const InjectMcpOptions = (): TypedParameterDecorator<McpOptions> => injector<McpOptions>(MCP_OPTIONS)

/** Token of the remote MCP client. */
export const MCP_REMOTE: unique symbol = Symbol("integrations.mcp.remote")

/** Token of the MCP server side. */
export const MCP_SERVER: unique symbol = Symbol("integrations.mcp.server")

/** Injects the remote MCP client. Parameter type: McpRemote. */
export const InjectMcpRemote = (): TypedParameterDecorator<McpRemote> => injector<McpRemote>(MCP_REMOTE)

/** Injects the MCP server side. Parameter type: McpServing. */
export const InjectMcpServer = (): TypedParameterDecorator<McpServing> => injector<McpServing>(MCP_SERVER)
