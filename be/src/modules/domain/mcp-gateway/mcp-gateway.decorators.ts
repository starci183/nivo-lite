import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ConversationLeadsGate, DataRightsGate, NativeAdapter } from "./mcp-gateway.contracts"
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

/** Token of the data rights port: absent until the action graph binds one, and then no read is narrowed. */
export const DATA_RIGHTS_GATE: unique symbol = Symbol("domain.mcp-gateway.data-rights-gate")

/** Injects the data rights port. Parameter type: DataRightsGate. */
export const InjectDataRightsGate = (): TypedParameterDecorator<DataRightsGate> =>
    injector<DataRightsGate>(DATA_RIGHTS_GATE)

/** Token of the conversation leads port: absent until the owner of conversations binds one, and then a run with no conversation of its own cannot address a conversation. */
export const CONVERSATION_LEADS_GATE: unique symbol = Symbol("domain.mcp-gateway.conversation-leads-gate")

/** Injects the conversation leads port. Parameter type: ConversationLeadsGate. */
export const InjectConversationLeadsGate = (): TypedParameterDecorator<ConversationLeadsGate> =>
    injector<ConversationLeadsGate>(CONVERSATION_LEADS_GATE)
