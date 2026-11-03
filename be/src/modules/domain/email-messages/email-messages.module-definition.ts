import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { EmailMessagesOptions } from "./email-messages.options"

/** The configurable-module base of the email-messages capability. */
const definition = new ConfigurableModuleBuilder<EmailMessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    EmailMessagesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: EmailMessagesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
