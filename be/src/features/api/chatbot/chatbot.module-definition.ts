import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatbotApiOptions } from "./chatbot.options"

/** The configurable-module base of the chatbot module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ChatbotApiOptions>()
