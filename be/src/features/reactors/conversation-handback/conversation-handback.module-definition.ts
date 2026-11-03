import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConversationHandbackOptions } from "./conversation-handback.options"

/** The configurable-module base of the conversation-handback module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConversationHandbackOptions>()
