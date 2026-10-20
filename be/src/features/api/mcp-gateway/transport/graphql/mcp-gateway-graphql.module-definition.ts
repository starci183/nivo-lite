import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpGatewayGraphqlOptions } from "./mcp-gateway-graphql.options"

/** The configurable-module base of the MCP gateway GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<McpGatewayGraphqlOptions>().setClassMethodName("register").build()
