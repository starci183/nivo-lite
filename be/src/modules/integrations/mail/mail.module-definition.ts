import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { MAIL_OPTIONS } from "./mail.decorators"
import type { MailOptions } from "./mail.options"

/** The configurable-module base of the mail integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<MailOptions>({ optionsInjectionToken: MAIL_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MailOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: MailOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
