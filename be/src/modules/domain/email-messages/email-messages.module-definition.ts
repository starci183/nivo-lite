import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EmailMessagesOptions } from "./email-messages.options"

/** The configurable-module base of the email-messages capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<EmailMessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
