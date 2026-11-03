import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatbotGraphqlOptions } from "./chatbot-graphql.options"

/** The configurable-module base of the chatbot-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ChatbotGraphqlOptions>()
