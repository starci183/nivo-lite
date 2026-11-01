import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConversationHandbackOptions } from "./conversation-handback.options"

/** The configurable-module base of the conversation-handback module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConversationHandbackOptions>().setClassMethodName("register").build()
