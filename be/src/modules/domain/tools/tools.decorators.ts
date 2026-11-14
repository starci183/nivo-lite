import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ConversationLeadsGate, NativeToolFamily } from "./tools.contracts"
import type { ToolsOptions } from "./tools.options"

/** Token of the gateway options. */
export const TOOLS_OPTIONS: unique symbol = Symbol("domain.tools.options")

/** Token of the native adapters registered in code. */
export const NATIVE_TOOL_FAMILIES: unique symbol = Symbol("domain.tools.native-tool-families")

/** Injects the gateway options. Parameter type: ToolsOptions. */
export const InjectToolsOptions = (): TypedParameterDecorator<ToolsOptions> =>
    injector<ToolsOptions>(TOOLS_OPTIONS)

/** Injects the native adapters. Parameter type: ReadonlyArray<NativeToolFamily>. */
export const InjectNativeToolFamilies = (): TypedParameterDecorator<ReadonlyArray<NativeToolFamily>> =>
    injector<ReadonlyArray<NativeToolFamily>>(NATIVE_TOOL_FAMILIES)

/** Token of the conversation leads port: absent until the owner of conversations binds one, and then a run with no conversation of its own cannot address a conversation. */
export const CONVERSATION_LEADS_GATE: unique symbol = Symbol("domain.tools.conversation-leads-gate")

/** Injects the conversation leads port. Parameter type: ConversationLeadsGate. */
export const InjectConversationLeadsGate = (): TypedParameterDecorator<ConversationLeadsGate> =>
    injector<ConversationLeadsGate>(CONVERSATION_LEADS_GATE)
