import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatbotApiOptions } from "./chatbot.options"

/** The configurable-module base of the chatbot module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChatbotApiOptions>().setClassMethodName("register").build()
