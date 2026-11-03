import { defineCapabilityModule } from "@starci/nest-kit"
import type { EmailMessagesOptions } from "./email-messages.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<EmailMessagesOptions>()
