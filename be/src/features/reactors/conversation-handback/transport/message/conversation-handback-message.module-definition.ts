import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConversationHandbackMessageOptions } from "./conversation-handback-message.options"

/** The configurable-module base of the conversation-handback-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConversationHandbackMessageOptions>().setClassMethodName("register").build()
