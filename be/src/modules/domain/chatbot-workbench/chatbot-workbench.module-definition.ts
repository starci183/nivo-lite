import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatbotWorkbenchOptions } from "./chatbot-workbench.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatbotWorkbenchOptions>()
