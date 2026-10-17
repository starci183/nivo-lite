import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatbotGraphqlOptions } from "./chatbot-graphql.options"

/** The configurable-module base of the chatbot-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChatbotGraphqlOptions>().setClassMethodName("register").build()
