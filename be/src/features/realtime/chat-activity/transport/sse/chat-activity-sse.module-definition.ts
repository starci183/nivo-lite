import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ChatActivitySseOptions } from "./chat-activity-sse.options"

type Host = ConfigurableModuleHost<ChatActivitySseOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ChatActivitySseOptions>().setClassMethodName("register").build()

/** The configurable-module base of the chat-activity-sse module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass
