import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { NativeAdapter } from "./mcp-gateway.contracts"
import type { McpGatewayOptions } from "./mcp-gateway.options"

/** Token of the gateway options. */
export const MCP_GATEWAY_OPTIONS: unique symbol = Symbol("domain.mcp-gateway.options")

/** Token of the native adapters registered in code. */
export const NATIVE_ADAPTERS: unique symbol = Symbol("domain.mcp-gateway.native-adapters")

/** Injects the gateway options. Parameter type: McpGatewayOptions. */
export const InjectMcpGatewayOptions = (): TypedParameterDecorator<McpGatewayOptions> =>
    injector<McpGatewayOptions>(MCP_GATEWAY_OPTIONS)

/** Injects the native adapters. Parameter type: ReadonlyArray<NativeAdapter>. */
export const InjectNativeAdapters = (): TypedParameterDecorator<ReadonlyArray<NativeAdapter>> =>
    injector<ReadonlyArray<NativeAdapter>>(NATIVE_ADAPTERS)
