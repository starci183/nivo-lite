import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatTurnOptions } from "./chat-turn.options"

/** The configurable-module base of the chat-turn module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChatTurnOptions>().setClassMethodName("register").build()
