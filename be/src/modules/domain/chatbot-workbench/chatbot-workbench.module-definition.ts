import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatbotWorkbenchOptions } from "./chatbot-workbench.options"

/** The configurable base of the Chatbot read projection. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChatbotWorkbenchOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
