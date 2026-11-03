import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { I18N_OPTIONS } from "./i18n.decorators"
import type { I18nOptions } from "./i18n.options"

/** The configurable-module base of the i18n capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<I18nOptions>({ optionsInjectionToken: I18N_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    I18nOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: I18nOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
