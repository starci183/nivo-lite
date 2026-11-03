import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConversationHandbackMessageOptions } from "./conversation-handback-message.options"

/** The configurable-module base of the conversation-handback-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConversationHandbackMessageOptions>()
