import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatReplyApiOptions } from "./chatreply.options"

/** The configurable-module base of the chatreply module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChatReplyApiOptions>().setClassMethodName("register").build()
