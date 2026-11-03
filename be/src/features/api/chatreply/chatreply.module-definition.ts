import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatReplyApiOptions } from "./chatreply.options"

/** The configurable-module base of the chatreply module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ChatReplyApiOptions>()
