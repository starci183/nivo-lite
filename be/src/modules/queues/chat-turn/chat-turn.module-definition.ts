import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChatTurnOptions } from "./chat-turn.options"

/** The configurable-module base of the chat-turn module. */
const definition = new ConfigurableModuleBuilder<ChatTurnOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<ChatTurnOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: ChatTurnOptions = definition.OPTIONS_TYPE
