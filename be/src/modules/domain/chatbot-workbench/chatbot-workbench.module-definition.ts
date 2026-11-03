import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChatbotWorkbenchOptions } from "./chatbot-workbench.options"

/** The configurable base of the Chatbot read projection. */
const definition = new ConfigurableModuleBuilder<ChatbotWorkbenchOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChatbotWorkbenchOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChatbotWorkbenchOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
