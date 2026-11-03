import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ChatTypingSseOptions } from "./chat-typing-sse.options"

type Host = ConfigurableModuleHost<ChatTypingSseOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ChatTypingSseOptions>().setClassMethodName("register").build()

/** The configurable-module base of the chat-typing-sse module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass
